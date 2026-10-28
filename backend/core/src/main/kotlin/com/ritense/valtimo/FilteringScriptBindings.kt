/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


package com.ritense.valtimo

import mu.KotlinLogging
import org.graalvm.polyglot.Context
import java.util.concurrent.atomic.AtomicBoolean
import javax.script.Bindings
import javax.script.ScriptContext
import javax.script.SimpleScriptContext

internal class FilteringScriptBindings(private val delegate: Bindings) : Bindings {
    private fun hidden(key: Any?) = key is String && key.startsWith(OPTION_PREFIX)

    // Invariant: the polyglot context key is hidden from iteration only (so GraalJS does not copy it into the
    // guest global) but stays readable by key (GraalJS reuses it and context cleanup closes it).
    private fun visible() = delegate.entries.filterNot { hidden(it.key) || it.key == POLYGLOT_CONTEXT_KEY }

    override fun put(name: String, value: Any?): Any? = delegate.put(name, value)

    override fun putAll(toMerge: Map<out String, Any?>) = delegate.putAll(toMerge)

    override fun containsKey(key: String): Boolean = !hidden(key) && delegate.containsKey(key)

    override fun get(key: String): Any? = if (hidden(key)) null else delegate[key]

    override fun remove(key: String): Any? = delegate.remove(key)

    override val size: Int get() = visible().size

    override fun isEmpty(): Boolean = visible().isEmpty()

    override fun containsValue(value: Any?): Boolean = visible().any { it.value == value }

    override fun clear() = delegate.clear()

    override val keys: MutableSet<String> get() = visible().mapTo(LinkedHashSet()) { it.key }

    override val values: MutableCollection<Any?> get() = visible().mapTo(ArrayList()) { it.value }

    // GraalJS iterates the entries right after it has defined its own globals in the guest and before the script
    // runs, so this is the point where they can still be removed on the caller-bindings path.
    override val entries: MutableSet<MutableMap.MutableEntry<String, Any?>>
        get() {
            (delegate[POLYGLOT_CONTEXT_KEY] as? Context)?.let { removeInjectedGlobals(it) }
            return visible().mapTo(LinkedHashSet()) { it }
        }

    companion object {
        const val OPTION_PREFIX = "polyglot.js."

        private const val POLYGLOT_CONTEXT_KEY = "polyglot.context"

        private const val HOST_BINDINGS_CLASS = "com.oracle.truffle.js.scriptengine.GraalJSBindings"

        private val INJECTED_GLOBALS = listOf("engine", "context", POLYGLOT_CONTEXT_KEY)

        private val logger = KotlinLogging.logger {}

        private val reported = AtomicBoolean(false)

        fun removeInjectedGlobals(context: Context): Boolean {
            val removed = try {
                val globals = context.getBindings("js")
                INJECTED_GLOBALS.forEach { globals.removeMember(it) }
                INJECTED_GLOBALS.none { globals.hasMember(it) }
            } catch (e: Exception) {
                false
            }
            if (!removed) reportInactive(reported)
            return removed
        }

        internal fun reportInactive(flag: AtomicBoolean) {
            if (flag.compareAndSet(false, true)) {
                logger.error { INACTIVE_MESSAGE }
            }
        }

        private const val INACTIVE_MESSAGE = "Script sandbox: engine-provided objects could not be removed from the " +
            "script scope. Scripts are still restricted by the class access policy, but a defence-in-depth layer is " +
            "inactive. This typically follows a GraalVM/GraalJS upgrade."

        private fun isHostCreated(bindings: Bindings) = bindings.javaClass.name == HOST_BINDINGS_CLASS

        fun wrap(bindings: Bindings): Bindings =
            if (isHostCreated(bindings) || bindings is FilteringScriptBindings) {
                bindings
            } else {
                FilteringScriptBindings(bindings)
            }

        fun wrap(context: ScriptContext): ScriptContext {
            val engineScope = context.getBindings(ScriptContext.ENGINE_SCOPE)
            if (engineScope != null && isHostCreated(engineScope)) return context
            val copy = SimpleScriptContext()
            copy.reader = context.reader
            copy.writer = context.writer
            copy.errorWriter = context.errorWriter
            context.getBindings(ScriptContext.GLOBAL_SCOPE)?.let { copy.setBindings(wrap(it), ScriptContext.GLOBAL_SCOPE) }
            if (engineScope != null) copy.setBindings(wrap(engineScope), ScriptContext.ENGINE_SCOPE)
            return copy
        }
    }
}
