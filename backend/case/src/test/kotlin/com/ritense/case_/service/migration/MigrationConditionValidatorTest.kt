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
import com.ritense.case_.service.migration.MigrationConditionValidator.MAX_DEPTH
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class MigrationConditionValidatorTest {

    @Test
    fun `should accept an empty condition list`() {
        assertThatCode { MigrationConditionValidator.validate(emptyList()) }.doesNotThrowAnyException()
    }

    @Test
    fun `should accept nested groups`() {
        val conditions = listOf(
            MigrationCondition("case:internalStatus", "==", "in-behandeling"),
            AnyOfMigrationCondition(
                listOf(
                    MigrationCondition("doc:/spoed", "==", true),
                    AllOfMigrationCondition(listOf(MigrationCondition("doc:/bedrag", ">=", 1000))),
                )
            ),
        )

        assertThatCode { MigrationConditionValidator.validate(conditions) }.doesNotThrowAnyException()
    }

    @Test
    fun `should reject an unsupported operator, also inside a group`() {
        assertThatThrownBy {
            MigrationConditionValidator.validate(listOf(MigrationCondition("doc:/x", "~=", "y")))
        }.hasMessageContaining("Unsupported migration condition operator '~='")

        assertThatThrownBy {
            MigrationConditionValidator.validate(
                listOf(AnyOfMigrationCondition(listOf(MigrationCondition("doc:/x", "~=", "y"))))
            )
        }.hasMessageContaining("Unsupported migration condition operator '~='")
    }

    @Test
    fun `should reject a blank path`() {
        assertThatThrownBy {
            MigrationConditionValidator.validate(listOf(MigrationCondition(" ", "==", "y")))
        }.hasMessageContaining("requires a non-blank 'path'")
    }

    @Test
    fun `should reject an empty group`() {
        assertThatThrownBy {
            MigrationConditionValidator.validate(listOf(AnyOfMigrationCondition(emptyList())))
        }.hasMessageContaining("'anyOf' requires at least one entry")

        assertThatThrownBy {
            MigrationConditionValidator.validate(listOf(AllOfMigrationCondition(emptyList())))
        }.hasMessageContaining("'allOf' requires at least one entry")
    }

    @Test
    fun `should reject groups nested deeper than the maximum`() {
        assertThatCode { MigrationConditionValidator.validate(listOf(nest(MAX_DEPTH))) }.doesNotThrowAnyException()

        assertThatThrownBy { MigrationConditionValidator.validate(listOf(nest(MAX_DEPTH + 1))) }
            .hasMessageContaining("may not nest more than $MAX_DEPTH levels deep")
    }

    /** A chain of [depth] nested groups, with a single condition at the bottom. */
    private fun nest(depth: Int): MigrationConditionNode = if (depth <= 1) {
        MigrationCondition("doc:/x", "==", "y")
    } else {
        AllOfMigrationCondition(listOf(nest(depth - 1)))
    }
}
