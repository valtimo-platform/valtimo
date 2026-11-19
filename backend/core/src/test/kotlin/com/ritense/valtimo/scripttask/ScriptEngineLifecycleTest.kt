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

import com.ritense.valtimo.AllowedClassesScriptEngineResolver
import org.graalvm.polyglot.Context
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.lang.ref.WeakReference
import javax.script.Bindings
import javax.script.ScriptEngineManager
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ScriptEngineLifecycleTest {

    private val resolver = AllowedClassesScriptEngineResolver(ScriptEngineManager())

    @AfterEach
    fun tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization()
        }
    }

    @Test
    fun `resolved engines share one polyglot engine`() {
        TransactionSynchronizationManager.initSynchronization()
        val first = resolver.getScriptEngine(LANGUAGE, true)
        val second = resolver.getScriptEngine(LANGUAGE, true)

        val firstContext = contextAfterEval(RecordingBindings(first.createBindings()), first)
        val secondContext = contextAfterEval(RecordingBindings(second.createBindings()), second)

        assertTrue(firstContext.engine == secondContext.engine)
        complete()
    }

    @Test
    fun `without transaction contexts are closed after eval`() {
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        val bindings = RecordingBindings(engine.createBindings())
        engine.eval("var o = {a: 1}", bindings)

        val context = requireNotNull(bindings.polyglotContext)

        assertTrue(runCatching { context.eval("js", "1") }.isFailure)
    }

    @Test
    fun `with transaction contexts stay usable until completion and are then closed`() {
        TransactionSynchronizationManager.initSynchronization()
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        val bindings = RecordingBindings(engine.createBindings())
        val result = engine.eval("({a: 1})", bindings)
        val context = requireNotNull(bindings.polyglotContext)

        assertEquals(1, (result as Map<*, *>)["a"])
        assertEquals(2, context.eval("js", "1 + 1").asInt())

        complete()

        assertTrue(runCatching { context.eval("js", "1") }.isFailure)
    }

    @Test
    fun `repeated runs do not retain contexts`() {
        val refs = mutableListOf<WeakReference<Any>>()
        val contextRefs = mutableListOf<WeakReference<Any>>()
        repeat(RUNS) {
            TransactionSynchronizationManager.initSynchronization()
            val engine = resolver.getScriptEngine(LANGUAGE, true)
            val bindings = RecordingBindings(engine.createBindings())
            engine.eval(SCRIPT, bindings)
            refs += WeakReference<Any>(bindings)
            contextRefs += WeakReference<Any>(bindings.polyglotContext)
            complete()
        }

        repeat(5) {
            System.gc()
            Thread.sleep(100)
        }

        assertTrue(refs.count { it.get() != null } <= 1)
        assertTrue(contextRefs.count { it.get() != null } <= 1)
    }

    private fun contextAfterEval(bindings: RecordingBindings, engine: javax.script.ScriptEngine): Context {
        engine.eval(SCRIPT, bindings)
        return requireNotNull(bindings.polyglotContext)
    }

    private fun complete() {
        TransactionSynchronizationManager.getSynchronizations()
            .forEach { it.afterCompletion(TransactionSynchronization.STATUS_COMMITTED) }
        TransactionSynchronizationManager.clearSynchronization()
    }

    private class RecordingBindings(private val delegate: Bindings) : Bindings by delegate {
        var polyglotContext: Context? = null

        override fun put(key: String, value: Any?): Any? {
            if (value is Context) polyglotContext = value
            return delegate.put(key, value)
        }
    }

    companion object {
        private const val LANGUAGE = "javascript"
        private const val SCRIPT = "var c = 1 + 2;"
        private const val RUNS = 50
    }
}
