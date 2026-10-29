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

/** Checks a plan's conditions on deploy, so a mistake surfaces then rather than silently gating every case out of the migration hours later. */
object MigrationConditionValidator {

    /** How deep condition groups may nest. Deep enough for real plans, shallow enough to stay readable. */
    const val MAX_DEPTH = 10

    private const val PROCESS_VARIABLE_PREFIX = "pv:"

    fun validate(conditions: List<MigrationConditionNode>) = conditions.forEach { validate(it, 1) }

    private fun validate(node: MigrationConditionNode, depth: Int) {
        require(depth <= MAX_DEPTH) { "Migration condition groups may not nest more than $MAX_DEPTH levels deep" }

        when (node) {
            is MigrationCondition -> {
                require(node.path.isNotBlank()) { "A migration condition requires a non-blank 'path'" }
                require(!node.path.startsWith(PROCESS_VARIABLE_PREFIX)) {
                    "Migration condition path '${node.path}' reads a process variable, which a condition may " +
                        "not do. Conditions are evaluated for every case on the source version, and a case " +
                        "whose process has ended has no variables to read. Gate on the document (`doc:`) or " +
                        "on the case itself (`case:`) instead, and use `pv:` in the plan's components, which " +
                        "run per case against a process that is known to be there."
                }
                require(node.operator in MigrationConditionEvaluator.SUPPORTED_OPERATORS) {
                    "Unsupported migration condition operator '${node.operator}' on path '${node.path}'. " +
                        "Supported operators: ${MigrationConditionEvaluator.SUPPORTED_OPERATORS.joinToString()}"
                }
            }

            // An empty group is rejected rather than given a meaning: empty `allOf` matches every case and empty `anyOf` none.
            is AllOfMigrationCondition -> {
                require(node.allOf.isNotEmpty()) { "A migration condition group 'allOf' requires at least one entry" }
                node.allOf.forEach { validate(it, depth + 1) }
            }

            is AnyOfMigrationCondition -> {
                require(node.anyOf.isNotEmpty()) { "A migration condition group 'anyOf' requires at least one entry" }
                node.anyOf.forEach { validate(it, depth + 1) }
            }
        }
    }
}
