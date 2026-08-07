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

/**
 * Evaluates a migration plan's gating conditions against a single case. A [MigrationCondition]'s
 * [MigrationCondition.path] is a value-resolver path (e.g. `case:internalStatus`, `doc:/foo`)
 * resolved against the case document; the resolved value is then compared with the condition's
 * operator and value.
 *
 * Supported operators:
 * - `==`, `!=` - equality, compared as text
 * - `>`, `>=`, `<`, `<=` - ordering, numeric when both sides are numbers, lexicographic otherwise
 * - `in` - the resolved value is one of the condition's values (a list, or a comma-separated string)
 * - `contains` - the resolved value contains the condition's value (list membership for a list,
 *   substring containment for a single value)
 * - `exists` - the resolved value is present; `"value": false` inverts it to "must be absent"
 *
 * Conditions may be nested in AND/OR groups ([AllOfMigrationCondition], [AnyOfMigrationCondition]);
 * the plan's top-level list is AND-combined.
 *
 * A plan with no conditions always matches. A triggered plan only migrates cases whose conditions
 * currently hold; the rest are retried on the next hourly trigger.
 */
class MigrationConditionEvaluator(
    private val valueResolverService: ValueResolverService,
) {

    fun matches(caseId: UUID, conditions: List<MigrationConditionNode>): Boolean {
        if (conditions.isEmpty()) return true

        // All paths in the tree are resolved in one go, including those an OR group might not have
        // needed: a single resolve call per case is what keeps selecting 45k cases affordable.
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

    /**
     * Whether the resolved value is one of the expected values. The expected value is either a list
     * (`"value": ["a", "b"]`) or a comma-separated string (`"value": "a,b"`), the latter being what
     * the plan editor's single-line value field produces.
     */
    private fun inValue(actual: Any?, expected: Any?): Boolean {
        if (actual == null || expected == null) return false
        return collectionOf(expected).any { equalsValue(actual, it) }
    }

    /**
     * Whether the resolved value contains the expected value: membership when the resolved value is
     * a list, substring containment when it is a single value.
     */
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

    /**
     * The existence the condition asks for. `exists` without a value - or with `true` - requires the
     * value to be present; `false` requires it to be absent.
     */
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
