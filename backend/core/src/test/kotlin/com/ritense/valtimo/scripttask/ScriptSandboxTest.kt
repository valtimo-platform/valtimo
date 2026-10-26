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
import com.oracle.truffle.js.scriptengine.GraalJSScriptEngine
import com.ritense.valtimo.FilteringScriptBindings
import com.ritense.valtimo.GraalJsContextCleanup
import com.ritense.valtimo.ScriptSandboxSelfCheck
import org.graalvm.polyglot.Context
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.Reader
import java.io.StringReader
import javax.script.Compilable
import javax.script.ScriptException
import javax.script.ScriptEngine
import javax.script.ScriptEngineManager
import javax.script.SimpleBindings
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ScriptSandboxTest {

    private val resolver = AllowedClassesScriptEngineResolver(ScriptEngineManager())

    private fun engine(): ScriptEngine = resolver.getScriptEngine("javascript", true)

    @Test
    fun `polyglot context is not a script global and injected objects expose nothing callable`() {
        val probe = "var out = []; for (var n of ['engine', 'context']) { var o = globalThis[n]; " +
            "if (o === undefined) continue; for (var m in o) { if (typeof o[m] === 'function') out.push(n + '.' + m); } } " +
            "out.join() + '|' + typeof globalThis['polyglot.context']"
        val result = engine().eval(probe, SimpleBindings())

        assertEquals("|undefined", result)
    }

    @Test
    fun `engine globals are not defined for caller bindings`() {
        val result = engine().eval(
            "typeof engine + ',' + typeof context + ',' + typeof globalThis['polyglot.context']",
            SimpleBindings()
        )

        assertEquals("undefined,undefined,undefined", result)
    }

    @Test
    fun `engine globals are not defined for a reused compiled script`() {
        val engine = engine()
        val compiled = (engine as Compilable).compile("typeof engine + ',' + typeof context")
        val bindings = SimpleBindings()

        assertEquals("undefined,undefined", compiled.eval(bindings))
        assertEquals("undefined,undefined", compiled.eval(bindings))
    }

    @Test
    fun `polyglot context stays readable by key but is hidden from iteration`() {
        val delegate = SimpleBindings()
        val marker = Any()
        delegate["polyglot.context"] = marker
        delegate["a"] = 1
        val bindings = FilteringScriptBindings(delegate)

        assertEquals(1, bindings.size)
        assertFalse(bindings.isEmpty())
        assertEquals(setOf("a"), bindings.keys)
        assertEquals(listOf<Any?>(1), bindings.values.toList())
        assertEquals(setOf("a"), bindings.entries.map { it.key }.toSet())
        assertFalse(bindings.containsValue(marker))
        assertTrue(bindings.containsKey("polyglot.context"))
        assertTrue(bindings["polyglot.context"] === marker)
        bindings["polyglot.context"] = 5
        assertEquals(5, bindings["polyglot.context"])
        bindings.remove("polyglot.context")
        assertFalse(bindings.containsKey("polyglot.context"))
    }

    @Test
    fun `option-like keys are hidden from get and containsKey`() {
        val delegate = SimpleBindings()
        delegate["polyglot.js.foo"] = true
        val bindings = FilteringScriptBindings(delegate)

        assertFalse(bindings.containsKey("polyglot.js.foo"))
        assertEquals(null, bindings["polyglot.js.foo"])
        assertTrue(bindings.isEmpty())
    }

    private fun assertNotCallable(setup: (ScriptEngine, SimpleBindings) -> Unit, probe: String) {
        val engine = engine()
        val bindings = SimpleBindings()
        setup(engine, bindings)
        val result = try {
            engine.eval(probe, bindings)
        } catch (e: ScriptException) {
            "blocked"
        }
        assertTrue(result == "undefined" || result == "blocked", "$probe -> $result")
    }

    @Test
    fun `engine compile is not callable`() =
        assertNotCallable({ e, b -> b["eng"] = e }, "typeof eng.compile")

    @Test
    fun `engine invokeFunction is not callable`() =
        assertNotCallable({ e, b -> b["eng"] = e }, "typeof eng.invokeFunction")

    @Test
    fun `engine invokeMethod is not callable`() =
        assertNotCallable({ e, b -> b["eng"] = e }, "typeof eng.invokeMethod")

    @Test
    fun `bindings close is not callable`() =
        assertNotCallable({ e, b -> b["created"] = e.createBindings() }, "typeof created.close")

    @Test
    fun `compiled script eval is not callable`() =
        assertNotCallable({ e, b -> b["compiled"] = (e as Compilable).compile("1") }, "typeof compiled.eval")

    @Test
    fun `map entry getKey is not callable`() =
        assertNotCallable({ _, b -> b["entry"] = mapOf("k" to "v").entries.first() }, "typeof entry.getKey")

    @Test
    fun `engine globals are not defined for default scope eval`() {
        val result = engine().eval("typeof engine + ',' + typeof context")

        assertEquals("undefined,undefined", result)
    }

    @Test
    fun `engine objects handed to a script cannot be used`() {
        val engine = engine()
        val bindings = SimpleBindings()
        bindings["probe"] = engine
        bindings["probeContext"] = engine.context
        bindings["probeBindings"] = engine.createBindings()

        assertThrows<Exception> { engine.eval("probe.getFactory()", bindings) }
        assertThrows<Exception> { engine.eval("probeContext.getErrorWriter()", bindings) }
        assertThrows<Exception> { engine.eval("probeBindings.size()", bindings) }
    }

    @Test
    fun `option-like variable does not enable class lookup and does not break the script`() {
        val bindings = SimpleBindings()
        bindings["polyglot.js.allowHostClassLookup"] = true
        bindings["a"] = 1

        assertEquals(2, (engine().eval("a + 1", bindings) as Number).toInt())
        assertThrows<Exception> { engine().eval("Java.type('java.lang.System')", bindings) }
    }

    @Test
    fun `compiled script stays restricted after evaluation with option-like variable`() {
        val compiled = (engine() as Compilable).compile("Java.type('java.lang.System')")
        val withOption = SimpleBindings().also { it["polyglot.js.allowHostClassLookup"] = true }

        assertThrows<Exception> { compiled.eval(withOption) }
        assertThrows<Exception> { compiled.eval(SimpleBindings()) }
    }

    @Test
    fun `normal behaviour is intact`() {
        val engine = engine()
        val bindings = SimpleBindings()
        bindings["x"] = 40

        assertEquals(42, (engine.eval("x + 2", bindings) as Number).toInt())
        assertEquals(
            "PT1S",
            engine.eval("Java.type('java.time.Duration').ofSeconds(1).toString()", SimpleBindings())
        )
        assertEquals(listOf(1, 2), engine.eval("[1, 2]", SimpleBindings()))
    }

    private class RecordingReader(text: String) : Reader() {
        private val inner = StringReader(text)
        var closed = false

        override fun read(cbuf: CharArray, off: Int, len: Int): Int = inner.read(cbuf, off, len)

        override fun close() {
            closed = true
            inner.close()
        }
    }

    @Test
    fun `strict mode directive is honoured`() {
        assertThrows<Exception> { engine().eval("'use strict'; undeclaredName = 1;", SimpleBindings()) }
        assertThrows<Exception> { engine().eval("'use strict'; undeclaredName = 1;") }
    }

    @Test
    fun `hashbang line is accepted`() {
        assertEquals(3, (engine().eval("#!/usr/bin/env node\n1 + 2", SimpleBindings()) as Number).toInt())
    }

    @Test
    fun `error position matches authored source`() {
        val ex = assertThrows<ScriptException> { engine().eval("var a = ;", SimpleBindings()) }

        assertEquals(1, ex.lineNumber)
        assertTrue(ex.columnNumber in 0..9 || ex.columnNumber == -1, "column ${ex.columnNumber}")
        assertFalse(ex.message.orEmpty().contains("globalThis"))
        assertFalse(ex.message.orEmpty().contains("delete"))
    }

    @Test
    fun `reader is closed after eval and compile`() {
        val evalReader = RecordingReader("1 + 1")
        engine().eval(evalReader, SimpleBindings())
        assertTrue(evalReader.closed)

        val compileReader = RecordingReader("1 + 1")
        (engine() as Compilable).compile(compileReader)
        assertTrue(compileReader.closed)
    }

    @Test
    fun `objects reachable from bindings expose no callable members`() {
        val engine = engine()
        val bindings = SimpleBindings()
        bindings["probe"] = engine
        bindings["probeContext"] = engine.context
        val result = engine.eval(
            "[typeof probe.close, typeof probe.compile, typeof probe.invokeFunction, typeof probeContext.getBindings].join()",
            bindings
        )

        assertEquals("undefined,undefined,undefined,undefined", result)
    }

    @Test
    fun `non whitelisted class lookup stays rejected`() {
        assertThrows<Exception> { engine().eval("Java.type('java.lang.Runtime')", SimpleBindings()) }
    }

    class InheritingMap : java.util.AbstractMap<String, String>() {
        override val entries: MutableSet<MutableMap.MutableEntry<String, String>> = mutableSetOf()
    }

    private class RecordingBindings : SimpleBindings() {
        private var context: Context? = null
        private var lastSeen: Boolean? = null
        var entriesReads = 0
        val definedAtEntries = mutableListOf<Boolean>()

        override fun get(key: String): Any? {
            val value = super.get(key)
            if (key == "polyglot.context" && value is Context) {
                context = value
                lastSeen = value.getBindings("js").hasMember("engine")
            }
            return value
        }

        override val entries: MutableSet<MutableMap.MutableEntry<String, Any?>>
            get() {
                entriesReads++
                lastSeen?.let { definedAtEntries.add(it) }
                return super.entries
            }
    }

    @Test
    fun `scope setup order is unchanged`() {
        val recording = RecordingBindings()
        engine().eval("1", recording)

        val message = "GraalJS no longer defines its globals before copying the caller bindings, " +
            "so the removal hook no longer runs at the right time"
        assertTrue(recording.entriesReads > 0, message)
        assertTrue(recording.definedAtEntries.isNotEmpty() && recording.definedAtEntries.all { it }, message)
    }

    @Test
    fun `self check passes on the current configuration`() {
        assertTrue(ScriptSandboxSelfCheck.run(engine()))
        assertEquals(0, GraalJsContextCleanup.pendingCount())
    }

    @Test
    fun `self check reports a failure without throwing`() {
        val plain = GraalJSScriptEngine.create(null, Context.newBuilder("js"))

        assertFalse(ScriptSandboxSelfCheck.run(plain))
    }

    @Test
    fun `removal failure is reported without throwing`() {
        val closed = Context.create("js")
        closed.close()

        assertFalse(FilteringScriptBindings.removeInjectedGlobals(closed))
    }

    @Test
    fun `map style members are not callable`() =
        assertNotCallable({ _, b -> b["map"] = InheritingMap() }, "typeof map.keySet")
}
