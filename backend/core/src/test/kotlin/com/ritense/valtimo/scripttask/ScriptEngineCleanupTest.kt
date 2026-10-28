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
import org.graalvm.polyglot.HostAccess
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.camunda.bpm.engine.impl.cfg.TransactionListener
import org.camunda.bpm.engine.impl.cfg.TransactionState
import org.camunda.bpm.engine.impl.cfg.TransactionContext
import org.camunda.bpm.engine.impl.interceptor.CommandContext
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.io.StringReader
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import javax.script.Bindings
import javax.script.Compilable
import javax.script.ScriptEngine
import javax.script.ScriptContext
import javax.script.ScriptEngineManager
import javax.script.SimpleScriptContext
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue
import org.camunda.bpm.engine.impl.context.Context as CamundaContext

class ScriptEngineCleanupTest {

    private val sharedEngine = AllowedClassesScriptEngineResolver.newPolyglotEngine()
    private val resolver = AllowedClassesScriptEngineResolver(ScriptEngineManager())
    private var commandContextSet = false

    @AfterEach
    fun tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization()
        }
        if (commandContextSet) {
            CamundaContext.removeCommandContext()
            commandContextSet = false
        }
        TransactionSynchronizationManager.getResourceMap().keys.toList()
            .forEach { TransactionSynchronizationManager.unbindResourceIfPossible(it) }
    }

    @Test
    fun `camunda command context closes contexts on commit`() {
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
    fun `camunda command context closes contexts on rollback`() {
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

        GraalJsContextCleanup.closingAfter {
            engine.eval("function twice(x) { return x * 2 }")
            assertEquals(4, (engine.invokeFunction("twice", 2) as Number).toInt())
        }

        assertNotNull(engine.factory)
        assertEquals("Graal.js", engine.factory.engineName)
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
        first.eval(SCRIPT, firstBindings)
        val secondBindings = bindingsFor(second)
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

    @Test
    fun `compiled script shared across wrappers closes bindings of the evaluating wrapper`() {
        val first = resolver.getScriptEngine(LANGUAGE, true) as TrackingGraalJsScriptEngine
        val second = resolver.getScriptEngine(LANGUAGE, true) as TrackingGraalJsScriptEngine
        val compiled = first.compile(SCRIPT)
        val bindings = bindingsFor(second)

        compiled.eval(bindings)

        assertTrue(isClosed(polyglotContext(bindings)))
    }

    @Test
    fun `bindings of another thread are not closed by an evaluation`() {
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        val created = CountDownLatch(1)
        val otherDone = CountDownLatch(1)
        val failure = AtomicReference<Throwable>()
        val otherBindings = AtomicReference<Bindings>()
        val thread = Thread {
            try {
                val bindings = bindingsFor(engine)
                otherBindings.set(bindings)
                created.countDown()
                assertTrue(otherDone.await(30, TimeUnit.SECONDS))
                engine.eval(SCRIPT, bindings)
                assertTrue(isClosed(polyglotContext(bindings)))
            } catch (e: Throwable) {
                failure.set(e)
                created.countDown()
            }
        }
        thread.start()
        assertTrue(created.await(30, TimeUnit.SECONDS))

        val ownBindings = bindingsFor(engine)
        engine.eval(SCRIPT, ownBindings)
        assertTrue(isClosed(polyglotContext(ownBindings)))
        otherDone.countDown()
        thread.join(30_000)

        assertNull(failure.get())
    }

    @Test
    fun `nested evaluation does not close outer bindings`() {
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        var outer: Bindings? = null
        var inner: Bindings? = null

        GraalJsContextCleanup.closingAfter {
            val outerBindings = bindingsFor(engine)
            outer = outerBindings
            GraalJsContextCleanup.closingAfter { engine.eval(SCRIPT, outerBindings) }
            val innerBindings = bindingsFor(engine)
            inner = innerBindings
            engine.eval(SCRIPT, innerBindings)
            assertFalse(isClosed(polyglotContext(outerBindings)))
            assertFalse(isClosed(polyglotContext(innerBindings)))
        }

        assertTrue(isClosed(polyglotContext(requireNotNull(outer))))
        assertTrue(isClosed(polyglotContext(requireNotNull(inner))))
    }

    @Test
    fun `no pending bindings remain after outermost evaluation`() {
        val engine = resolver.getScriptEngine(LANGUAGE, true)
        val bindings = bindingsFor(engine)
        engine.eval(SCRIPT, bindings)

        assertEquals(0, GraalJsContextCleanup.pendingCount())
    }

    @Test
    fun `compiled eval with script context closes the eval context`() {
        val (wrapper, _) = newWrapper()
        val compiled = wrapper.compile("({a: 1})")
        val bindings = bindingsFor(wrapper)
        val scriptContext = SimpleScriptContext()
        scriptContext.setBindings(bindings, ScriptContext.ENGINE_SCOPE)

        val result = compiled.eval(scriptContext)

        assertTrue(result is LinkedHashMap<*, *>)
        assertEquals(1, (result as Map<*, *>)["a"])
        assertTrue(isClosed(polyglotContext(bindings)))
        assertEquals(0, GraalJsContextCleanup.pendingCount())
    }

    @Test
    fun `default context is closed after eval of string`() {
        val (wrapper, delegate) = newWrapper()

        val result = wrapper.eval("1 + 2")
        val context = delegate.polyglotContext

        assertEquals(3, (result as Number).toInt())
        assertTrue(isClosed(context))
        assertEquals(0, GraalJsContextCleanup.pendingCount())
    }

    @Test
    fun `put then eval uses and closes the default context`() {
        val (wrapper, delegate) = newWrapper()

        wrapper.put("x", 21)
        val result = wrapper.eval("x * 2")

        assertEquals(42, (result as Number).toInt())
        assertTrue(isClosed(delegate.polyglotContext))
        assertEquals(0, GraalJsContextCleanup.pendingCount())
    }

    @Test
    fun `compile closes the default context after the first outermost eval`() {
        val (first, firstDelegate) = newWrapper()
        val compiled = first.compile("1 + 2")
        val defaultContext = firstDelegate.polyglotContext
        assertFalse(isClosed(defaultContext))

        repeat(3) {
            val (other, _) = newWrapper()
            assertEquals(3, (compiled.eval(bindingsFor(other)) as Number).toInt())
            if (it == 0) assertTrue(isClosed(defaultContext))
        }
    }

    @Test
    fun `invokeFunction within one outer closing scope works and closes afterwards`() {
        val (wrapper, delegate) = newWrapper()
        var context: Context? = null

        GraalJsContextCleanup.closingAfter {
            wrapper.eval("function f(a) { return a * 2 }")
            assertEquals(4, (wrapper.invokeFunction("f", 2) as Number).toInt())
            context = delegate.polyglotContext
            assertFalse(isClosed(delegate.polyglotContext))
        }

        assertTrue(isClosed(requireNotNull(context)))
    }

    @Test
    fun `default context stays open until spring transaction completes`() {
        TransactionSynchronizationManager.initSynchronization()
        val (wrapper, delegate) = newWrapper()

        wrapper.eval("function f(a) { return a * 2 }")
        val context = delegate.polyglotContext
        assertEquals(4, (wrapper.invokeFunction("f", 2) as Number).toInt())
        assertFalse(isClosed(context))

        TransactionSynchronizationManager.getSynchronizations()
            .forEach { it.afterCompletion(TransactionSynchronization.STATUS_COMMITTED) }

        assertTrue(isClosed(context))
    }

    @Test
    fun `setBindings closes both old and new default contexts`() {
        val (wrapper, delegate) = newWrapper()
        wrapper.put("x", 1)
        val oldContext = delegate.polyglotContext
        GraalJsContextCleanup.closingAfter {
            wrapper.setBindings(delegate.createBindings(), ScriptContext.ENGINE_SCOPE)
            val newContext = delegate.polyglotContext
            assertEquals(2, (wrapper.eval("1 + 1") as Number).toInt())
            assertFalse(isClosed(newContext))
            contexts = listOf(oldContext, newContext)
        }

        contexts.forEach { assertTrue(isClosed(it)) }
    }

    @Test
    fun `closing an untouched default context does not create one`() {
        val (_, delegate) = newWrapper()
        val untouched = delegate.getBindings(ScriptContext.ENGINE_SCOPE)

        GraalJsContextCleanup.track(untouched, ownContextOnly = true)
        GraalJsContextCleanup.closingAfter { }
        GraalJsContextCleanup.close(untouched, ownContextOnly = true)

        assertEquals(0, GraalJsContextCleanup.pendingCount())
    }

    private var contexts: List<Context> = emptyList()

    private fun newWrapper(): Pair<TrackingGraalJsScriptEngine, GraalJSScriptEngine> {
        val delegate = GraalJSScriptEngine.create(sharedEngine, Context.newBuilder("js").allowHostAccess(HostAccess.ALL))
        return TrackingGraalJsScriptEngine(delegate) to delegate
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
        CamundaContext.setCommandContext(commandContext)
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
