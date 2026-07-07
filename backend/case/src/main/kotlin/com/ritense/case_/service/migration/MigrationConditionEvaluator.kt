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

package com.ritense.case_.service.migration

import com.ritense.case_.domain.migration.MigrationCondition
import com.ritense.valueresolver.ValueResolverService
import java.math.BigDecimal
import java.util.UUID

/**
 * Evaluates a migration plan's gating [MigrationCondition]s against a single case. A condition's
 * [MigrationCondition.path] is a value-resolver path (e.g. `case:internalStatus`, `doc:/foo`)
 * resolved against the case document; the resolved value is then compared with the condition's
 * operator and value.
 *
 * A plan with no conditions always matches. A triggered plan only migrates cases whose conditions
 * currently hold; the rest are retried on the next hourly trigger.
 */
class MigrationConditionEvaluator(
    private val valueResolverService: ValueResolverService,
) {

    fun matches(caseId: UUID, conditions: List<MigrationCondition>): Boolean {
        if (conditions.isEmpty()) return true

        val resolved = valueResolverService.resolveValues(caseId.toString(), conditions.map { it.path }.distinct())

        return conditions.all { condition ->
            evaluate(resolved[condition.path], condition.operator, condition.value)
        }
    }

    private fun evaluate(actual: Any?, operator: String, expected: Any?): Boolean {
        return when (operator) {
            "==" -> equalsValue(actual, expected)
            "!=" -> !equalsValue(actual, expected)
            ">", ">=", "<", "<=" -> compareValue(actual, expected, operator)
            else -> throw IllegalArgumentException("Unsupported migration condition operator '$operator'")
        }
    }

    private fun equalsValue(actual: Any?, expected: Any?): Boolean {
        if (actual == null || expected == null) return actual == expected
        return actual.toString() == expected.toString()
    }

    private fun compareValue(actual: Any?, expected: Any?, operator: String): Boolean {
        if (actual == null || expected == null) return false
        val comparison = numericOf(actual)?.let { a -> numericOf(expected)?.let { b -> a.compareTo(b) } }
            ?: actual.toString().compareTo(expected.toString())
        return when (operator) {
            ">" -> comparison > 0
            ">=" -> comparison >= 0
            "<" -> comparison < 0
            "<=" -> comparison <= 0
            else -> throw IllegalArgumentException("Unsupported migration condition operator '$operator'")
        }
    }

    private fun numericOf(value: Any?): BigDecimal? = when (value) {
        is BigDecimal -> value
        is Number -> BigDecimal(value.toString())
        is String -> value.toBigDecimalOrNull()
        else -> null
    }
}
