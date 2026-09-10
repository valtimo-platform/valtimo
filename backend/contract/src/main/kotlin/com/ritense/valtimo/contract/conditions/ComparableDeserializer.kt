/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.contract.conditions

import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.databind.DeserializationContext
import com.fasterxml.jackson.databind.deser.std.StdDeserializer
import java.time.LocalDateTime
import java.time.ZonedDateTime

class ComparableDeserializer : StdDeserializer<Comparable<*>>(Comparable::class.java) {
    override fun deserialize(p: JsonParser, ctxt: DeserializationContext): Comparable<*> {
        return when (val value = ctxt.readValue(p, Any::class.java)) {
            is List<*> -> ComparableList(value)
            else -> value as Comparable<*>
        }
    }
}

/**
 * Wrapper that lets a JSON array be used as a Condition value (for the 'in' and 'list_contains'
 * operators). Ordering comparisons against a list are not meaningful.
 */
data class ComparableList(
    private val values: List<Any?>
) : List<Any?> by values, Comparable<ComparableList> {
    override fun compareTo(other: ComparableList): Int =
        throw UnsupportedOperationException("A list value can only be used with the 'in' or 'list_contains' operators")
}

class ZonedToLocalDateTime : StdDeserializer<LocalDateTime>(LocalDateTime::class.java) {
    override fun deserialize(p: JsonParser, ctxt: DeserializationContext): LocalDateTime {
        return ctxt.readValue(p, ZonedDateTime::class.java).toLocalDateTime()
    }
}