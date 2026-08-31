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

import com.ritense.case_.domain.migration.AllOfMigrationCondition
import com.ritense.case_.domain.migration.AnyOfMigrationCondition
import com.ritense.case_.domain.migration.MigrationCondition
import com.ritense.case_.domain.migration.MigrationConditionNode
import com.ritense.valueresolver.ValueResolverService
import java.math.BigDecimal
import java.util.UUID

/** Evaluates a plan's gating conditions against one case: a value-resolver path compared with `==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `contains` or `exists`, nestable in allOf/anyOf groups. No conditions always matches. */
class MigrationConditionEvaluator(
    private val valueResolverService: ValueResolverService,
) {

    fun matches(caseId: UUID, conditions: List<MigrationConditionNode>): Boolean {
        if (conditions.isEmpty()) return true

        // Every path in the tree is resolved in one call, including those an OR group may not need: that is what keeps selecting 45k cases affordable.
        val resolved = valueResolverService.resolveValues(caseId.toString(), pathsOf(conditions))

        return conditions.all { matches(it, resolved) }
    }

    private fun matches(node: MigrationConditionNode, resolved: Map<String, Any?>): Boolean = when (node) {
        is MigrationCondition -> evaluate(resolved[node.path], node.operator, node.value)
        is AllOfMigrationCondition -> node.allOf.all { matches(it, resolved) }
        is AnyOfMigrationCondition -> node.anyOf.any { matches(it, resolved) }
    }

    private fun pathsOf(nodes: List<MigrationConditionNode>): List<String> = nodes
        .flatMap { node ->
            when (node) {
                is MigrationCondition -> listOf(node.path)
                is AllOfMigrationCondition -> pathsOf(node.allOf)
                is AnyOfMigrationCondition -> pathsOf(node.anyOf)
            }
        }
        .distinct()

    private fun evaluate(actual: Any?, operator: String, expected: Any?): Boolean {
        return when (operator) {
            "==" -> equalsValue(actual, expected)
            "!=" -> !equalsValue(actual, expected)
            ">", ">=", "<", "<=" -> compareValue(actual, expected, operator)
            "in" -> inValue(actual, expected)
            "contains" -> containsValue(actual, expected)
            "exists" -> existsValue(actual) == expectedExistence(expected)
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

    /** Whether the resolved value is one of the expected values — a list, or the comma-separated string the plan editor's single-line field produces. */
    private fun inValue(actual: Any?, expected: Any?): Boolean {
        if (actual == null || expected == null) return false
        return collectionOf(expected).any { equalsValue(actual, it) }
    }

    /** Whether the resolved value contains the expected one: membership for a list, substring otherwise. */
    private fun containsValue(actual: Any?, expected: Any?): Boolean {
        if (actual == null || expected == null) return false
        val elements = elementsOf(actual)
        return if (elements != null) {
            elements.any { equalsValue(it, expected) }
        } else {
            actual.toString().contains(expected.toString())
        }
    }

    /** Whether the value could be resolved at all. An empty value counts as absent. */
    private fun existsValue(actual: Any?): Boolean = when (actual) {
        null -> false
        is CharSequence -> actual.isNotBlank()
        is Collection<*> -> actual.isNotEmpty()
        is Map<*, *> -> actual.isNotEmpty()
        else -> true
    }

    /** The existence the condition asks for: `exists` with no value or `true` requires presence, `false` absence. */
    private fun expectedExistence(expected: Any?): Boolean = when {
        expected == null -> true
        expected is Boolean -> expected
        expected.toString().isBlank() -> true
        else -> expected.toString().toBooleanStrictOrNull()
            ?: throw IllegalArgumentException(
                "Migration condition operator 'exists' expects no value, 'true' or 'false', but got '$expected'"
            )
    }

    /** The expected values of an `in` condition, as a list. */
    private fun collectionOf(expected: Any): Collection<Any?> = elementsOf(expected)
        ?: expected.toString().split(",").map { it.trim() }

    /** The elements of a multi-valued value, or `null` when the value is not multi-valued. */
    private fun elementsOf(value: Any?): Collection<Any?>? = when (value) {
        is Collection<*> -> value
        is Array<*> -> value.toList()
        else -> null
    }

    private fun numericOf(value: Any?): BigDecimal? = when (value) {
        is BigDecimal -> value
        is Number -> BigDecimal(value.toString())
        is String -> value.toBigDecimalOrNull()
        else -> null
    }

    companion object {
        /** The operators [evaluate] dispatches on. Kept here so a plan can be validated on deploy. */
        val SUPPORTED_OPERATORS = setOf("==", "!=", ">", ">=", "<", "<=", "in", "contains", "exists")
    }
}
