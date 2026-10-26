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
    private val UNSUPPORTED_TYPES = setOf("Promise", "WeakMap", "WeakSet", "WeakRef", "FinalizationRegistry")

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
        return convert(value, 0)
    }

    private fun convert(value: Value, depth: Int): Any? {
        if (depth > MAX_DEPTH) {
            throw ScriptException("Script result nesting too deep or cyclic")
        }
        return when {
            value.isNull -> null
            value.isHostObject -> value.asHostObject<Any?>()
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
                    list += if (isOmitted(element)) null else convert(element, depth + 1)
                }
                list
            }
            value.hasHashEntries() -> convertMap(value, depth)
            value.hasIterator() && metaName(value) == "Set" -> convertSet(value, depth)
            value.isIterator || value.hasIterator() || metaName(value) in UNSUPPORTED_TYPES -> unsupported(value)
            value.hasMembers() -> {
                val map = LinkedHashMap<String, Any?>()
                for (key in value.memberKeys) {
                    val member = value.getMember(key)
                    if (!isOmitted(member)) {
                        map[key] = convert(member, depth + 1)
                    }
                }
                map
            }
            else -> unsupported(value)
        }
    }

    private fun convertMap(value: Value, depth: Int): Map<Any?, Any?> {
        val map = LinkedHashMap<Any?, Any?>()
        val iterator = value.hashEntriesIterator
        while (iterator.hasIteratorNextElement()) {
            val entry = iterator.iteratorNextElement
            val key = entry.getArrayElement(0)
            val entryValue = entry.getArrayElement(1)
            if (!isOmitted(key) && !isOmitted(entryValue)) {
                map[convert(key, depth + 1)] = convert(entryValue, depth + 1)
            }
        }
        return map
    }

    private fun convertSet(value: Value, depth: Int): List<Any?> {
        val list = ArrayList<Any?>()
        val iterator = value.iterator
        while (iterator.hasIteratorNextElement()) {
            val element = iterator.iteratorNextElement
            list += if (isOmitted(element)) null else convert(element, depth + 1)
        }
        return list
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
