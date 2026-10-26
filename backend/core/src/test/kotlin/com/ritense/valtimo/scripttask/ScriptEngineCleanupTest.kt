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

import com.oracle.truffle.js.scriptengine.GraalJSScriptEngine
import com.ritense.valtimo.AllowedClassesScriptEngineResolver
import com.ritense.valtimo.GraalJsContextCleanup
import com.ritense.valtimo.TrackingGraalJsScriptEngine
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.Engine
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.impl.cfg.TransactionListener
import org.operaton.bpm.engine.impl.cfg.TransactionState
import org.operaton.bpm.engine.impl.cfg.TransactionContext
import org.operaton.bpm.engine.impl.interceptor.CommandContext
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.io.StringReader
import javax.script.Bindings
import javax.script.Compilable
import javax.script.ScriptEngine
import javax.script.ScriptEngineManager
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue
import org.operaton.bpm.engine.impl.context.Context as OperatonContext

class ScriptEngineCleanupTest {

    private val resolver = AllowedClassesScriptEngineResolver(ScriptEngineManager())
    private var commandContextSet = false

    @AfterEach
    fun tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization()
        }
        if (commandContextSet) {
            OperatonContext.removeCommandContext()
            commandContextSet = false
        }
        TransactionSynchronizationManager.getResourceMap().keys.toList()
            .forEach { TransactionSynchronizationManager.unbindResourceIfPossible(it) }
    }

    @Test
    fun `operaton command context closes contexts on commit`() {
        val listeners = mockCommandContext()
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        val bindings = bindingsFor(engine)
        engine.eval(SCRIPT, bindings)
        val context = polyglotContext(bindings)

        assertEquals(2, context.eval("js", "1 + 1").asInt())
        assertTrue(listeners.containsKey(TransactionState.COMMITTED))
        assertTrue(listeners.containsKey(TransactionState.ROLLED_BACK))

        listeners.getValue(TransactionState.COMMITTED).execute(mock())

        assertTrue(isClosed(context))
    }

    @Test
    fun `operaton command context closes contexts on rollback`() {
        val listeners = mockCommandContext()
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        val bindings = bindingsFor(engine)
        engine.eval(SCRIPT, bindings)
        val context = polyglotContext(bindings)

        listeners.getValue(TransactionState.ROLLED_BACK).execute(mock())

        assertTrue(isClosed(context))
    }

    @Test
    fun `spring rollback closes contexts`() {
        TransactionSynchronizationManager.initSynchronization()
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        val bindings = bindingsFor(engine)
        engine.eval(SCRIPT, bindings)
        val context = polyglotContext(bindings)

        TransactionSynchronizationManager.getSynchronizations()
            .forEach { it.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK) }

        assertTrue(isClosed(context))
    }

    @Test
    fun `two bindings in one transaction are both closed and resource is unbound`() {
        TransactionSynchronizationManager.initSynchronization()
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        val firstBindings = bindingsFor(engine)
        val secondBindings = bindingsFor(engine)
        engine.eval(SCRIPT, firstBindings)
        engine.eval(SCRIPT, secondBindings)
        val first = polyglotContext(firstBindings)
        val second = polyglotContext(secondBindings)

        assertEquals(1, TransactionSynchronizationManager.getSynchronizations().size)
        TransactionSynchronizationManager.getSynchronizations()
            .forEach { it.afterCompletion(TransactionSynchronization.STATUS_COMMITTED) }

        assertTrue(isClosed(first))
        assertTrue(isClosed(second))
        assertTrue(TransactionSynchronizationManager.getResourceMap().isEmpty())
    }

    @Test
    fun `close does not throw when already closed`() {
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        val bindings = bindingsFor(engine)
        engine.eval(SCRIPT, bindings)

        GraalJsContextCleanup.close(bindings)
        GraalJsContextCleanup.close(bindings)
    }

    @Test
    fun `close does not throw for bindings without context`() {
        val engine = resolver.getScriptEngine(LANGUAGE, true)

        GraalJsContextCleanup.close(bindingsFor(engine))
    }

    @Test
    fun `compiled script is closed after eval without transaction`() {
        val engine = resolver.getScriptEngine(LANGUAGE, true) as Compilable
        val scriptEngine = engine as ScriptEngine
        val compiled = engine.compile(SCRIPT)
        val bindings = bindingsFor(scriptEngine)
        val result = compiled.eval(bindings)
        val context = polyglotContext(bindings)

        assertNull(result)
        assertTrue(isClosed(context))
        assertSame(scriptEngine, compiled.engine)
    }

    @Test
    fun `compiled script from reader is closed after eval without transaction`() {
        val engine = resolver.getScriptEngine(LANGUAGE, true) as Compilable
        val compiled = engine.compile(StringReader("1 + 2"))
        val bindings = bindingsFor(engine as ScriptEngine)
        val result = compiled.eval(bindings)

        assertEquals(3, (result as Number).toInt())
        assertTrue(isClosed(polyglotContext(bindings)))
    }

    @Test
    fun `compiled script context stays open until transaction completes`() {
        TransactionSynchronizationManager.initSynchronization()
        val engine = resolver.getScriptEngine(LANGUAGE, true) as Compilable
        val compiled = engine.compile("({a: 1})")
        val bindings = bindingsFor(engine as ScriptEngine)
        val result = compiled.eval(bindings)
        val context = polyglotContext(bindings)

        assertEquals(1, (result as Map<*, *>)["a"])
        assertFalse(isClosed(context))

        TransactionSynchronizationManager.getSynchronizations()
            .forEach { it.afterCompletion(TransactionSynchronization.STATUS_COMMITTED) }

        assertTrue(isClosed(context))
    }

    @Test
    fun `eval with reader closes after eval without transaction`() {
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        val bindings = bindingsFor(engine)

        val result = engine.eval(StringReader("1 + 1"), bindings)

        assertEquals(2, (result as Number).toInt())
        assertTrue(isClosed(polyglotContext(bindings)))
    }

    @Test
    fun `wrapper delegates factory and invocable`() {
        val engine = resolver.getScriptEngine(LANGUAGE, true) as TrackingGraalJsScriptEngine
        val bindings = bindingsFor(engine)

        engine.eval("function twice(x) { return x * 2 }")

        assertNotNull(engine.factory)
        assertEquals("Graal.js", engine.factory.engineName)
        assertEquals(4, (engine.invokeFunction("twice", 2) as Number).toInt())
        GraalJsContextCleanup.close(bindings)
    }

    @Test
    fun `injected polyglot engine is used`() {
        Engine.newBuilder("js").option("engine.WarnInterpreterOnly", "false").build().use { injected ->
            val injectedResolver = AllowedClassesScriptEngineResolver(ScriptEngineManager(), emptySet(), injected)
            val engine = injectedResolver.getScriptEngine(LANGUAGE, true)
            val bindings = bindingsFor(engine)
            engine.eval(SCRIPT, bindings)

            assertSame(injected, polyglotContext(bindings).engine)
        }
    }

    @Test
    fun `fallback engine is created once per resolver`() {
        val first = resolver.getScriptEngine(LANGUAGE, true)
        val second = resolver.getScriptEngine(LANGUAGE, true)
        val firstBindings = bindingsFor(first)
        val secondBindings = bindingsFor(second)
        first.eval(SCRIPT, firstBindings)
        second.eval(SCRIPT, secondBindings)

        assertSame(polyglotContext(firstBindings).engine, polyglotContext(secondBindings).engine)
        assertTrue(first is TrackingGraalJsScriptEngine)
        assertTrue(GraalJSScriptEngine::class.java.isInstance(unwrap(first)))
    }

    @Test
    fun `non javascript language is not wrapped`() {
        val engine = resolver.getScriptEngine("no-such-language", true)

        assertNull(engine)
    }

    private fun mockCommandContext(): MutableMap<TransactionState, TransactionListener> {
        val listeners = mutableMapOf<TransactionState, TransactionListener>()
        val transactionContext = mock<TransactionContext>()
        val commandContext = mock<CommandContext>()
        whenever(commandContext.transactionContext).thenReturn(transactionContext)
        whenever(transactionContext.addTransactionListener(any(), any())).thenAnswer {
            listeners[it.getArgument(0)] = it.getArgument(1)
            null
        }
        OperatonContext.setCommandContext(commandContext)
        commandContextSet = true
        return listeners
    }

    private fun unwrap(engine: ScriptEngine): Any {
        val field = TrackingGraalJsScriptEngine::class.java.getDeclaredField("delegate")
        field.isAccessible = true
        return field.get(engine)
    }

    private fun bindingsFor(engine: ScriptEngine): Bindings = RecordingBindings(engine.createBindings())

    private fun polyglotContext(bindings: Bindings): Context =
        requireNotNull((bindings as RecordingBindings).polyglotContext)

    private class RecordingBindings(private val delegate: Bindings) : Bindings by delegate {
        var polyglotContext: Context? = null

        override fun put(key: String, value: Any?): Any? {
            if (value is Context) polyglotContext = value
            return delegate.put(key, value)
        }
    }

    private fun isClosed(context: Context): Boolean = runCatching { context.eval("js", "1") }.isFailure

    companion object {
        private const val LANGUAGE = "javascript"
        private const val SCRIPT = "var c = 1 + 2;"
    }
}
