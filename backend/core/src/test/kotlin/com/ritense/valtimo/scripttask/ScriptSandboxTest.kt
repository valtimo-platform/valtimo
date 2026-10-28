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

    private val mapResolver = AllowedClassesScriptEngineResolver(
        ScriptEngineManager(),
        setOf("java.util.HashMap", "java.util.LinkedHashMap", "java.util.TreeMap")
    )

    private fun mapEngine(): ScriptEngine = mapResolver.getScriptEngine("javascript", true)

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

    private fun assertNotCallable(
        setup: (ScriptEngine, SimpleBindings) -> Unit,
        probe: String,
        engine: ScriptEngine = engine()
    ) {
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
    fun `allowed map classes can be created and used`() {
        for (type in listOf("HashMap", "LinkedHashMap", "TreeMap")) {
            val result = mapEngine().eval(
                "var M = Java.type('java.util.$type'); var m = new M(); m.put('a', 1); m.put('b', 2); " +
                    "[m.get('a'), m.size(), m.containsKey('b'), m.keySet().size(), String(m.toString()).length > 0].join()",
                SimpleBindings()
            )

            assertEquals("1,2,true,2,true", result, type)
        }
    }

    @Test
    fun `map entries can be iterated`() {
        val bindings = SimpleBindings()
        bindings["kotlinMap"] = linkedMapOf("x" to "y")
        val result = mapEngine().eval(
            "var M = Java.type('java.util.HashMap'); var m = new M(); m.put('a', '1'); var out = []; " +
                "for (var e of m.entrySet()) { out.push(e.getKey() + '=' + e.getValue()); } " +
                "for (var e of kotlinMap.entrySet()) { out.push(e.getKey() + '=' + e.getValue()); } out.join()",
            bindings
        )

        assertEquals("a=1,x=y", result)
    }

    @Test
    fun `list streams can be used`() {
        val bindings = SimpleBindings()
        bindings["list"] = listOf(1, 2, 3, 4)
        val result = engine().eval(
            "var L = Java.type('java.util.ArrayList'); var created = new L(); created.add('a'); created.add('bb'); " +
                "[String(list.stream().filter(function (x) { return x % 2 == 0; }).map(function (x) { return x * 10; }).toList()), " +
                "created.stream().map(function (s) { return s.length; }).reduce(0, function (a, b) { return a + b; }), " +
                "list.stream().count()].join('|')",
            bindings
        )

        assertEquals("[20, 40]|3|4", result)
    }

    @Test
    fun `streams do not open reflection`() =
        assertNotCallable({ _, b -> b["list"] = listOf(1) }, "typeof list.stream().getClass().forName")

    @Test
    fun `map classes outside the allow list stay blocked`() {
        assertThrows<Exception> {
            mapEngine().eval("Java.type('java.util.concurrent.ConcurrentHashMap')", SimpleBindings())
        }
        assertThrows<Exception> { mapEngine().eval("Java.type('java.util.Hashtable')", SimpleBindings()) }
    }

    @Test
    fun `created maps do not open reflection`() {
        assertNotCallable(
            { _, _ -> },
            "var M = Java.type('java.util.HashMap'); typeof new M().getClass().getClassLoader",
            mapEngine()
        )
        assertNotCallable(
            { _, b -> b["entry"] = mapOf("k" to "v").entries.first() },
            "typeof entry.getClass().forName",
            mapEngine()
        )
    }

    @Test
    fun `host bindings handed to a script expose nothing usable`() {
        val engine = mapEngine()
        val polyglotContext = Context.create("js")
        try {
            val host = engine.createBindings()
            host["scriptEngine"] = engine
            host["scriptContext"] = engine.context
            host["polyglotContext"] = polyglotContext
            val bindings = SimpleBindings()
            bindings["host"] = host
            val probe = """
                var out = [];
                var reached = 0;
                var names = ['eval', 'getBindings', 'getContext', 'getEngine', 'getPolyglotContext', 'close'];
                function check(label, v) {
                    reached++;
                    for (var n of names) { if (typeof v[n] === 'function') out.push(label + '.' + n); }
                    if (typeof v.getClass().forName === 'function') out.push(label + '.forName');
                }
                for (var v of host.values()) check('values', v);
                for (var e of host.entrySet()) check('entrySet', e.getValue());
                for (var k of host.keySet()) { check('get', host.get(k)); check('getOrDefault', host.getOrDefault(k, null)); }
                out.join() + '|' + reached
            """.trimIndent()

            assertEquals("|12", engine.eval(probe, bindings))
        } finally {
            polyglotContext.close()
        }
    }
}
