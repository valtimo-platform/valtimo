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

package com.ritense.widget.fields

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.POJONode
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME
import java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME
import java.time.temporal.ChronoUnit.SECONDS
import java.time.temporal.TemporalAccessor
import java.util.UUID

/** A field value that is either one path, or a template such as `${doc:/firstName} ${doc:/lastName}`. */
object FieldValueTemplate {

    private val PLACEHOLDER = Regex("\\$\\{([^}]+)}")
    private val REPEATED_SPACES = Regex(" {2,}")

    fun getUnresolvedValues(value: String): List<String> {
        val placeholders = PLACEHOLDER.findAll(value).map { it.groupValues[1] }.toList()
        return placeholders.ifEmpty { listOf(value) }
    }

    fun resolve(value: String, resolveValue: (String) -> Any?): Any? {
        if (!PLACEHOLDER.containsMatchIn(value)) {
            return resolveValue(value)
        }
        var anyPlaceholderFilled = false
        val rendered = PLACEHOLDER.replace(value) { match ->
            asText(resolveValue(match.groupValues[1])).also { if (it.isNotBlank()) anyPlaceholderFilled = true }
        }
        return if (anyPlaceholderFilled) rendered.replace(REPEATED_SPACES, " ").trim() else null
    }

    private fun asText(value: Any?): String = when (value) {
        null -> ""
        is Collection<*> -> value.map { asText(it) }.filter { it.isNotBlank() }.joinToString(", ")
        is JsonNode -> asText(value)
        is BigDecimal -> value.stripTrailingZeros().toPlainString()
        is Double, is Float -> if ((value as Number).toDouble().isFinite()) asText(BigDecimal(value.toString())) else ""
        is LocalDateTime -> value.truncatedTo(SECONDS).format(ISO_LOCAL_DATE_TIME)
        is OffsetDateTime -> value.truncatedTo(SECONDS).format(ISO_OFFSET_DATE_TIME)
        is ZonedDateTime -> value.truncatedTo(SECONDS).format(ISO_OFFSET_DATE_TIME)
        is Instant -> value.truncatedTo(SECONDS).toString()
        is CharSequence, is Number, is Boolean, is Char, is Enum<*>, is UUID, is TemporalAccessor -> value.toString()
        // Anything else is an object with no single text form, so it is left out like an empty value
        else -> ""
    }

    private fun asText(node: JsonNode): String = when {
        node.isNumber -> asText(node.decimalValue())
        node is POJONode -> asText(node.pojo)
        node.isValueNode && !node.isNull -> node.asText()
        node.isArray -> asText(node.toList())
        else -> ""
    }
}
