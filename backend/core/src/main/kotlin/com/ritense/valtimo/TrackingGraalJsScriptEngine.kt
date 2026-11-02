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
import java.util.concurrent.atomic.AtomicBoolean
import javax.script.Bindings
import javax.script.Compilable
import javax.script.CompiledScript
import javax.script.Invocable
import javax.script.ScriptContext
import javax.script.ScriptEngine

class TrackingGraalJsScriptEngine(
    private val delegate: GraalJSScriptEngine
) : ScriptEngine by delegate, Compilable, Invocable by delegate {
    private val defaultTracked = AtomicBoolean(false)

    private fun trackDefaultContext() {
        if (defaultTracked.compareAndSet(false, true)) {
            GraalJsContextCleanup.track(delegate.getBindings(ScriptContext.ENGINE_SCOPE), ownContextOnly = true)
            FilteringScriptBindings.removeInjectedGlobals(delegate.polyglotContext)
        }
    }

    override fun eval(script: String): Any? {
        trackDefaultContext()
        return GraalJsContextCleanup.closingAfter { GraalJsValueConverter.toJava(delegate.eval(script)) }
    }

    override fun eval(reader: Reader): Any? {
        trackDefaultContext()
        return GraalJsContextCleanup.closingAfter { GraalJsValueConverter.toJava(delegate.eval(reader)) }
    }

    override fun invokeFunction(name: String, vararg args: Any?): Any? {
        trackDefaultContext()
        return GraalJsContextCleanup.closingAfter { GraalJsValueConverter.toJava(delegate.invokeFunction(name, *args)) }
    }

    override fun invokeMethod(thiz: Any?, name: String, vararg args: Any?): Any? {
        trackDefaultContext()
        return GraalJsContextCleanup.closingAfter { GraalJsValueConverter.toJava(delegate.invokeMethod(thiz, name, *args)) }
    }

    override fun <T> getInterface(clasz: Class<T>): T? {
        trackDefaultContext()
        return delegate.getInterface(clasz)
    }

    override fun <T> getInterface(thiz: Any?, clasz: Class<T>): T? {
        trackDefaultContext()
        return delegate.getInterface(thiz, clasz)
    }

    override fun put(key: String, value: Any?) {
        trackDefaultContext()
        delegate.put(key, value)
    }

    override fun get(key: String): Any? {
        trackDefaultContext()
        return delegate.get(key)
    }

    override fun getContext(): ScriptContext {
        trackDefaultContext()
        return delegate.context
    }

    override fun getBindings(scope: Int): Bindings? {
        if (scope == ScriptContext.ENGINE_SCOPE) trackDefaultContext()
        return delegate.getBindings(scope)
    }

    override fun setBindings(bindings: Bindings, scope: Int) {
        if (scope != ScriptContext.ENGINE_SCOPE) {
            delegate.setBindings(bindings, scope)
            return
        }
        trackDefaultContext()
        delegate.setBindings(bindings, scope)
        GraalJsContextCleanup.track(bindings, ownContextOnly = true)
    }

    override fun setContext(context: ScriptContext) {
        trackDefaultContext()
        delegate.context = context
        GraalJsContextCleanup.track(delegate.getBindings(ScriptContext.ENGINE_SCOPE), ownContextOnly = true)
    }

    override fun createBindings(): Bindings {
        val bindings = delegate.createBindings()
        GraalJsContextCleanup.track(bindings)
        return bindings
    }

    override fun eval(script: String, bindings: Bindings): Any? =
        GraalJsContextCleanup.closingAfter { GraalJsValueConverter.toJava(delegate.eval(script, FilteringScriptBindings.wrap(bindings))) }

    override fun eval(reader: Reader, bindings: Bindings): Any? =
        GraalJsContextCleanup.closingAfter { GraalJsValueConverter.toJava(delegate.eval(reader, FilteringScriptBindings.wrap(bindings))) }

    override fun eval(script: String, context: ScriptContext): Any? =
        GraalJsContextCleanup.closingAfter { GraalJsValueConverter.toJava(delegate.eval(script, FilteringScriptBindings.wrap(context))) }

    override fun eval(reader: Reader, context: ScriptContext): Any? =
        GraalJsContextCleanup.closingAfter { GraalJsValueConverter.toJava(delegate.eval(reader, FilteringScriptBindings.wrap(context))) }

    override fun compile(script: String): CompiledScript {
        trackDefaultContext()
        return wrap(delegate.compile(script))
    }

    override fun compile(reader: Reader): CompiledScript {
        trackDefaultContext()
        return wrap(delegate.compile(reader))
    }

    private fun wrap(compiled: CompiledScript): CompiledScript = object : CompiledScript() {
        override fun eval(context: ScriptContext): Any? =
            GraalJsContextCleanup.closingAfter { GraalJsValueConverter.toJava(compiled.eval(FilteringScriptBindings.wrap(context))) }

        override fun eval(bindings: Bindings): Any? =
            GraalJsContextCleanup.closingAfter { GraalJsValueConverter.toJava(compiled.eval(FilteringScriptBindings.wrap(bindings))) }

        override fun getEngine(): ScriptEngine = this@TrackingGraalJsScriptEngine
    }
}
