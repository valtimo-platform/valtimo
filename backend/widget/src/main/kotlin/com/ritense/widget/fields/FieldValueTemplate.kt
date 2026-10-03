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
            asText(resolveValue(match.groupValues[1])).also { if (it.isNotEmpty()) anyPlaceholderFilled = true }
        }
        return if (anyPlaceholderFilled) rendered.replace(REPEATED_SPACES, " ").trim() else null
    }

    private fun asText(value: Any?): String = when (value) {
        null -> ""
        is Collection<*> -> value.filterNotNull().joinToString(", ")
        else -> value.toString()
    }
}
