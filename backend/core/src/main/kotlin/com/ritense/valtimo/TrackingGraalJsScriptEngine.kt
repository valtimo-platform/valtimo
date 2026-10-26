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

import com.oracle.truffle.js.scriptengine.GraalJSScriptEngine
import java.io.Reader
import javax.script.Bindings
import javax.script.Compilable
import javax.script.CompiledScript
import javax.script.Invocable
import javax.script.ScriptContext
import javax.script.ScriptEngine

class TrackingGraalJsScriptEngine(
    private val delegate: GraalJSScriptEngine
) : ScriptEngine by delegate, Compilable, Invocable by delegate {
    private val immediate = mutableListOf<Bindings>()

    override fun createBindings(): Bindings {
        val bindings = delegate.createBindings()
        if (!GraalJsContextCleanup.registerDeferred(bindings)) {
            synchronized(immediate) { immediate += bindings }
        }
        return bindings
    }

    override fun eval(script: String, bindings: Bindings): Any? =
        closingAfter { GraalJsValueConverter.toJava(delegate.eval(script, bindings)) }

    override fun eval(reader: Reader, bindings: Bindings): Any? =
        closingAfter { GraalJsValueConverter.toJava(delegate.eval(reader, bindings)) }

    override fun eval(script: String, context: ScriptContext): Any? =
        closingAfter { GraalJsValueConverter.toJava(delegate.eval(script, context)) }

    override fun eval(reader: Reader, context: ScriptContext): Any? =
        closingAfter { GraalJsValueConverter.toJava(delegate.eval(reader, context)) }

    override fun compile(script: String): CompiledScript = wrap(delegate.compile(script))

    override fun compile(reader: Reader): CompiledScript = wrap(delegate.compile(reader))

    private fun wrap(compiled: CompiledScript): CompiledScript = object : CompiledScript() {
        override fun eval(context: ScriptContext): Any? = GraalJsValueConverter.toJava(compiled.eval(context))

        override fun eval(bindings: Bindings): Any? = closingAfter { GraalJsValueConverter.toJava(compiled.eval(bindings)) }

        override fun getEngine(): ScriptEngine = this@TrackingGraalJsScriptEngine
    }

    private fun <T> closingAfter(block: () -> T): T {
        try {
            return block()
        } finally {
            val pending = synchronized(immediate) { immediate.toList().also { immediate.clear() } }
            pending.forEach { GraalJsContextCleanup.close(it) }
        }
    }
}
