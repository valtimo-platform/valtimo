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
package com.ritense.valtimo.scripttask

import com.ritense.valtimo.TrackingGraalJsScriptEngine
import org.graalvm.polyglot.Context
import org.camunda.bpm.engine.impl.scripting.engine.ScriptEngineResolver
import java.util.Collections
import java.util.IdentityHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.io.Reader
import javax.script.CompiledScript
import javax.script.ScriptContext
import javax.script.Bindings
import javax.script.Compilable
import javax.script.Invocable
import javax.script.ScriptEngine

class RecordingScriptEngineResolver(
    private val original: ScriptEngineResolver,
    private val recordingThread: Thread = Thread.currentThread()
) : ScriptEngineResolver by original {
    private val recordedBindings = CopyOnWriteArrayList<Bindings>()
    private val captured: MutableMap<Bindings, Context> = Collections.synchronizedMap(IdentityHashMap())

    val contexts: List<Context>
        get() = recordedBindings.mapNotNull { captured[it] }

    private fun captureOpenContexts() {
        recordedBindings.filter { !captured.containsKey(it) }.forEach { bindings ->
            runCatching { bindings["polyglot.context"] as? Context }.getOrNull()?.let { captured[bindings] = it }
        }
    }

    override fun getScriptEngine(language: String?, resolveFromCache: Boolean): ScriptEngine? {
        val engine = original.getScriptEngine(language, resolveFromCache)
        return if (engine is TrackingGraalJsScriptEngine) RecordingEngine(engine) else engine
    }

    private inner class RecordingEngine(
        private val delegate: TrackingGraalJsScriptEngine
    ) : ScriptEngine by delegate, Compilable, Invocable by delegate {
        override fun createBindings(): Bindings {
            val bindings = delegate.createBindings()
            if (Thread.currentThread() === recordingThread) {
                recordedBindings += bindings
            }
            return bindings
        }

        override fun eval(script: String, bindings: Bindings): Any? =
            try {
                delegate.eval(script, bindings)
            } finally {
                captureOpenContexts()
            }

        override fun eval(reader: Reader, bindings: Bindings): Any? =
            try {
                delegate.eval(reader, bindings)
            } finally {
                captureOpenContexts()
            }

        override fun compile(script: String): CompiledScript = wrap(delegate.compile(script))

        override fun compile(reader: Reader): CompiledScript = wrap(delegate.compile(reader))

        private fun wrap(compiled: CompiledScript): CompiledScript = object : CompiledScript() {
            override fun eval(context: ScriptContext): Any? =
                try {
                    compiled.eval(context)
                } finally {
                    captureOpenContexts()
                }

            override fun eval(bindings: Bindings): Any? =
                try {
                    compiled.eval(bindings)
                } finally {
                    captureOpenContexts()
                }

            override fun getEngine(): ScriptEngine = this@RecordingEngine
        }
    }

    companion object {
        fun isClosed(context: Context): Boolean = runCatching { context.eval("js", "1") }.isFailure
    }
}
