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

import org.graalvm.polyglot.Value
import java.util.Date
import javax.script.ScriptException

internal object GraalJsValueConverter {
    private const val MAX_DEPTH = 64
    private const val MAX_NODES = 1_000_000
    private val UNSUPPORTED_TYPES = setOf("Promise", "WeakMap", "WeakSet", "WeakRef", "FinalizationRegistry")

    private class Conversion {
        var remaining = MAX_NODES
    }

    fun toJava(result: Any?): Any? {
        if (result == null || result is String || result is Number || result is Boolean || result is Char) {
            return result
        }
        val value = Value.asValue(result)
        if (isFunction(value)) {
            throw ScriptException("Script returned a function; functions cannot outlive the script")
        }
        if (isSymbol(value)) {
            return null
        }
        return convert(value, 0, Conversion())
    }

    private fun convert(value: Value, depth: Int, conversion: Conversion): Any? {
        spend(conversion)
        if (depth > MAX_DEPTH) {
            throw ScriptException("Script result nesting too deep or cyclic")
        }
        return when {
            value.isNull -> null
            value.isHostObject -> convertHost(value.asHostObject<Any?>(), depth, conversion)
            value.isString -> value.asString()
            value.isBoolean -> value.asBoolean()
            value.isNumber -> when {
                value.fitsInInt() -> value.asInt()
                value.fitsInLong() -> value.asLong()
                value.fitsInDouble() -> value.asDouble()
                value.fitsInBigInteger() -> value.asBigInteger()
                else -> value.asDouble()
            }
            value.isDate && value.isTime && value.isTimeZone -> Date.from(value.asInstant())
            value.hasArrayElements() -> {
                val list = ArrayList<Any?>()
                for (i in 0 until value.arraySize) {
                    val element = value.getArrayElement(i)
                    list += if (isOmitted(element)) null else convert(element, depth + 1, conversion)
                }
                list
            }
            value.hasHashEntries() -> convertMap(value, depth, conversion)
            value.hasIterator() && metaName(value) == "Set" -> convertSet(value, depth, conversion)
            value.isIterator || value.hasIterator() || metaName(value) in UNSUPPORTED_TYPES -> unsupported(value)
            value.hasMembers() -> {
                val map = LinkedHashMap<String, Any?>()
                for (key in value.memberKeys) {
                    val member = value.getMember(key)
                    if (!isOmitted(member)) {
                        map[key] = convert(member, depth + 1, conversion)
                    }
                }
                map
            }
            else -> unsupported(value)
        }
    }

    private fun convertMap(value: Value, depth: Int, conversion: Conversion): Map<Any?, Any?> {
        val map = LinkedHashMap<Any?, Any?>()
        val iterator = value.hashEntriesIterator
        while (iterator.hasIteratorNextElement()) {
            val entry = iterator.iteratorNextElement
            val key = entry.getArrayElement(0)
            val entryValue = entry.getArrayElement(1)
            if (!isOmitted(key) && !isOmitted(entryValue)) {
                map[convert(key, depth + 1, conversion)] = convert(entryValue, depth + 1, conversion)
            }
        }
        return map
    }

    private fun convertSet(value: Value, depth: Int, conversion: Conversion): List<Any?> {
        val list = ArrayList<Any?>()
        val iterator = value.iterator
        while (iterator.hasIteratorNextElement()) {
            val element = iterator.iteratorNextElement
            list += if (isOmitted(element)) null else convert(element, depth + 1, conversion)
        }
        return list
    }

    private fun spend(conversion: Conversion) {
        if (--conversion.remaining < 0) {
            throw ScriptException("Script result too large")
        }
    }

    private fun convertHost(obj: Any?, depth: Int, conversion: Conversion): Any? {
        if (depth > MAX_DEPTH) {
            throw ScriptException("Script result nesting too deep or cyclic")
        }
        if (obj == null || !obj.javaClass.name.startsWith("java.util.")) {
            return obj
        }
        return when (obj) {
            is Map<*, *> -> convertHostMap(obj, depth, conversion)
            is Collection<*> -> convertHostCollection(obj, depth, conversion)
            else -> obj
        }
    }

    private fun convertHostCollection(obj: Collection<*>, depth: Int, conversion: Conversion): Any {
        val converted = ArrayList<Any?>(obj.size)
        var changed = false
        for (element in obj) {
            spend(conversion)
            val result = convertElement(element, depth + 1, conversion)
            changed = changed || result !== element
            converted += result
        }
        return when {
            !changed -> obj
            obj is Set<*> -> LinkedHashSet(converted)
            else -> converted
        }
    }

    private fun convertHostMap(obj: Map<*, *>, depth: Int, conversion: Conversion): Any {
        val converted = LinkedHashMap<Any?, Any?>()
        var changed = false
        for ((key, entryValue) in obj) {
            spend(conversion)
            val newKey = convertElement(key, depth + 1, conversion)
            val newValue = convertElement(entryValue, depth + 1, conversion)
            if (newKey !== key || newValue !== entryValue) {
                changed = true
            }
            if (!isOmittedHost(key, entryValue)) {
                converted[newKey] = newValue
            }
        }
        return if (changed) converted else obj
    }

    private fun isOmittedHost(key: Any?, entryValue: Any?): Boolean =
        isOmittedElement(key) || isOmittedElement(entryValue)

    private fun isOmittedElement(element: Any?): Boolean {
        if (element == null || element is String || element is Number || element is Boolean || element is Char) {
            return false
        }
        return isOmitted(Value.asValue(element))
    }

    private fun convertElement(element: Any?, depth: Int, conversion: Conversion): Any? {
        if (element == null || element is String || element is Number || element is Boolean || element is Char) {
            return element
        }
        val value = Value.asValue(element)
        return if (isOmitted(value)) null else convert(value, depth, conversion)
    }

    private fun unsupported(value: Value): Nothing {
        val name = value.metaObject?.metaSimpleName ?: value.toString()
        throw ScriptException("Script result of type $name cannot be converted")
    }

    private fun metaName(value: Value): String? = value.metaObject?.metaSimpleName

    private fun isOmitted(value: Value): Boolean = isFunction(value) || isSymbol(value)

    private fun isSymbol(value: Value): Boolean =
        !value.isHostObject && value.metaObject?.metaSimpleName == "symbol"

    private fun isFunction(value: Value): Boolean = value.canExecute() && !value.isHostObject
}
