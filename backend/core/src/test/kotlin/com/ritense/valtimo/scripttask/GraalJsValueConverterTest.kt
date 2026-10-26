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
import org.junit.jupiter.api.Test
import java.util.Date
import javax.script.ScriptEngine
import javax.script.ScriptEngineManager
import javax.script.ScriptException
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GraalJsValueConverterTest {

    private val engine: ScriptEngine =
        AllowedClassesScriptEngineResolver(ScriptEngineManager()).getScriptEngine("javascript", true)

    private fun eval(script: String): Any? = engine.eval(script, engine.createBindings())

    @Test
    fun `converts objects and arrays to plain java values`() {
        val result = eval("({a: 1, b: 'x', c: true, d: null, e: [1, 2.5, {f: 'g'}]})")

        assertIs<LinkedHashMap<*, *>>(result)
        assertEquals(1, result["a"])
        assertEquals("x", result["b"])
        assertEquals(true, result["c"])
        assertTrue(result.containsKey("d"))
        assertNull(result["d"])
        val list = assertIs<ArrayList<*>>(result["e"])
        assertEquals(1, list[0])
        assertEquals(2.5, list[1])
        assertEquals(mapOf("f" to "g"), list[2])
    }

    @Test
    fun `converts undefined to null`() {
        assertNull(eval("undefined"))
    }

    @Test
    fun `converts date to java util date`() {
        assertEquals(Date(0), eval("new Date(0)"))
    }

    @Test
    fun `converts large integer to long`() {
        assertEquals(10000000000L, eval("({n: 10000000000})").let { (it as Map<*, *>)["n"] })
    }

    @Test
    fun `keeps host objects`() {
        val result = eval("new (Java.type('java.util.ArrayList'))()")

        assertEquals("java.util.ArrayList", result?.javaClass?.name)
    }

    @Test
    fun `fails on cyclic objects`() {
        assertFailsWith<ScriptException> { eval("var o = {}; o.self = o; o") }
    }

    @Test
    fun `omits function members and nulls function elements`() {
        assertEquals(mapOf("a" to 1), eval("({a: 1, fn: function() {}})"))
        assertEquals(listOf(1, null), eval("[1, function() {}]"))
    }

    @Test
    fun `fails on top level function`() {
        val exception = assertFailsWith<ScriptException> { eval("(function() {})") }

        assertTrue(exception.message.orEmpty().contains("Script returned a function"))
    }

    @Test
    fun `converts symbols following json semantics`() {
        assertNull(eval("Symbol('foo')"))
        assertEquals(mapOf("a" to 1), eval("({a: 1, s: Symbol()})"))
        assertEquals(listOf(1, null), eval("[1, Symbol()]"))
    }

    @Test
    fun `converts map to linked hash map`() {
        val result = eval("new Map([['k', 1], [2, {x: 'y'}], ['f', function() {}], [Symbol(), 1]])")

        assertIs<LinkedHashMap<*, *>>(result)
        assertEquals<Map<*, *>>(mapOf("k" to 1, 2 to mapOf("x" to "y")), result)
        assertEquals<List<*>>(listOf("k", 2), result.keys.toList())
    }

    @Test
    fun `converts set to list`() {
        assertEquals(listOf(1, "a", mapOf("b" to 2)), eval("new Set([1, 'a', {b: 2}])"))
        assertEquals(listOf(1, null), eval("new Set([1, Symbol()])"))
    }

    @Test
    fun `converts big numbers without precision loss`() {
        val result = eval("({big: 10n ** 30n, n: 2 ** 60, d: 1e30})") as Map<*, *>

        assertEquals(java.math.BigInteger.TEN.pow(30), result["big"])
        assertEquals(1152921504606846976L, result["n"])
        assertEquals(1e30, result["d"])
        assertEquals(java.math.BigInteger.TEN.pow(30), eval("10n ** 30n"))
    }

    @Test
    fun `fails on unsupported built in types`() {
        assertTrue(
            assertFailsWith<ScriptException> { eval("Promise.resolve(1)") }.message.orEmpty().contains("Promise")
        )
        assertTrue(
            assertFailsWith<ScriptException> { eval("new WeakMap()") }.message.orEmpty().contains("WeakMap")
        )
        assertFailsWith<ScriptException> { eval("(function* () { yield 1 })()") }
        assertFailsWith<ScriptException> { eval("new Map([[1, 2]]).entries()") }
    }
}
