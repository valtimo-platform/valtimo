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
import com.ritense.valueresolver.ValueResolverService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class MigrationConditionEvaluatorTest(
    @Mock private val valueResolverService: ValueResolverService,
) {

    private lateinit var evaluator: MigrationConditionEvaluator
    private val caseId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        evaluator = MigrationConditionEvaluator(valueResolverService)
    }

    @Test
    fun `should match when there are no conditions`() {
        assertThat(evaluator.matches(caseId, emptyList())).isTrue()
    }

    @Test
    fun `should match on equals`() {
        stub(mapOf("case:internalStatus" to "in-behandeling"))
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("case:internalStatus", "==", "in-behandeling")))).isTrue()
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("case:internalStatus", "==", "afgehandeld")))).isFalse()
    }

    @Test
    fun `should match on not-equals`() {
        stub(mapOf("case:internalStatus" to "in-behandeling"))
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("case:internalStatus", "!=", "afgehandeld")))).isTrue()
    }

    @Test
    fun `should match on numeric comparison`() {
        stub(mapOf("doc:/age" to 42))
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/age", ">", 18)))).isTrue()
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/age", "<", 18)))).isFalse()
    }

    @Test
    fun `should match on in with a list value`() {
        stub(mapOf("case:internalStatus" to "in-behandeling"))
        val statuses = listOf("in-behandeling", "afgehandeld")
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("case:internalStatus", "in", statuses)))).isTrue()
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("case:internalStatus", "in", listOf("afgehandeld"))))).isFalse()
    }

    @Test
    fun `should match on in with a comma separated value`() {
        stub(mapOf("case:internalStatus" to "in-behandeling"))
        assertThat(
            evaluator.matches(caseId, listOf(MigrationCondition("case:internalStatus", "in", "afgehandeld, in-behandeling")))
        ).isTrue()
        assertThat(
            evaluator.matches(caseId, listOf(MigrationCondition("case:internalStatus", "in", "afgehandeld,geannuleerd")))
        ).isFalse()
    }

    @Test
    fun `should not match on in when the value cannot be resolved`() {
        stub(emptyMap())
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/status", "in", listOf("a", "b"))))).isFalse()
    }

    @Test
    fun `should match on contains for a list value`() {
        stub(mapOf("doc:/tags" to listOf("spoed", "handmatig")))
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/tags", "contains", "spoed")))).isTrue()
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/tags", "contains", "regulier")))).isFalse()
    }

    @Test
    fun `should match on contains for a single value`() {
        stub(mapOf("doc:/description" to "aanvraag verhuizing"))
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/description", "contains", "verhuizing")))).isTrue()
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/description", "contains", "inspectie")))).isFalse()
    }

    @Test
    fun `should not match on contains when the value cannot be resolved`() {
        stub(emptyMap())
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/tags", "contains", "spoed")))).isFalse()
    }

    @Test
    fun `should match on exists without a value`() {
        stub(mapOf("doc:/reference" to "ZAAK-1"))
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/reference", "exists")))).isTrue()
    }

    @Test
    fun `should not match on exists when the value is absent, blank or empty`() {
        stub(emptyMap())
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/reference", "exists")))).isFalse()

        stub(mapOf("doc:/reference" to " "))
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/reference", "exists")))).isFalse()

        stub(mapOf("doc:/tags" to emptyList<String>()))
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/tags", "exists")))).isFalse()
    }

    @Test
    fun `should match on exists false when the value is absent`() {
        stub(emptyMap())
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/reference", "exists", false)))).isTrue()

        stub(mapOf("doc:/reference" to "ZAAK-1"))
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/reference", "exists", "false")))).isFalse()
    }

    @Test
    fun `should treat a blank exists value as no value`() {
        stub(mapOf("doc:/reference" to "ZAAK-1"))
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("doc:/reference", "exists", "")))).isTrue()
    }

    @Test
    fun `should fail on exists with a non-boolean value`() {
        stub(mapOf("doc:/reference" to "ZAAK-1"))
        assertThrows<IllegalArgumentException> {
            evaluator.matches(caseId, listOf(MigrationCondition("doc:/reference", "exists", "maybe")))
        }
    }

    @Test
    fun `should require all conditions to hold`() {
        stub(mapOf("case:internalStatus" to "in-behandeling", "doc:/age" to 42))
        val conditions = listOf(
            MigrationCondition("case:internalStatus", "==", "in-behandeling"),
            MigrationCondition("doc:/age", ">=", 42),
        )
        assertThat(evaluator.matches(caseId, conditions)).isTrue()
    }

    @Test
    fun `should not match when value cannot be resolved`() {
        stub(emptyMap())
        assertThat(evaluator.matches(caseId, listOf(MigrationCondition("case:internalStatus", "==", "in-behandeling")))).isFalse()
    }

    @Test
    fun `should fail on an unsupported operator`() {
        stub(mapOf("case:internalStatus" to "in-behandeling"))
        assertThrows<IllegalArgumentException> {
            evaluator.matches(caseId, listOf(MigrationCondition("case:internalStatus", "~=", "x")))
        }
    }

    @Test
    fun `should match an anyOf group when one entry holds`() {
        stub(mapOf("case:internalStatus" to "in-behandeling", "doc:/spoed" to false))
        val group = AnyOfMigrationCondition(
            listOf(
                MigrationCondition("doc:/spoed", "==", true),
                MigrationCondition("case:internalStatus", "==", "in-behandeling"),
            )
        )
        assertThat(evaluator.matches(caseId, listOf(group))).isTrue()
    }

    @Test
    fun `should not match an anyOf group when no entry holds`() {
        stub(mapOf("case:internalStatus" to "afgehandeld", "doc:/spoed" to false))
        val group = AnyOfMigrationCondition(
            listOf(
                MigrationCondition("doc:/spoed", "==", true),
                MigrationCondition("case:internalStatus", "==", "in-behandeling"),
            )
        )
        assertThat(evaluator.matches(caseId, listOf(group))).isFalse()
    }

    @Test
    fun `should match an allOf group only when every entry holds`() {
        stub(mapOf("doc:/bedrag" to 1500, "doc:/dossier" to "D-1"))
        val group = AllOfMigrationCondition(
            listOf(
                MigrationCondition("doc:/bedrag", ">=", 1000),
                MigrationCondition("doc:/dossier", "exists"),
            )
        )
        assertThat(evaluator.matches(caseId, listOf(group))).isTrue()

        stub(mapOf("doc:/bedrag" to 500, "doc:/dossier" to "D-1"))
        assertThat(evaluator.matches(caseId, listOf(group))).isFalse()
    }

    @Test
    fun `should match nested groups`() {
        // status == in-behandeling AND (spoed == true OR (bedrag >= 1000 AND dossier exists))
        val conditions = listOf(
            MigrationCondition("case:internalStatus", "==", "in-behandeling"),
            AnyOfMigrationCondition(
                listOf(
                    MigrationCondition("doc:/spoed", "==", true),
                    AllOfMigrationCondition(
                        listOf(
                            MigrationCondition("doc:/bedrag", ">=", 1000),
                            MigrationCondition("doc:/dossier", "exists"),
                        )
                    ),
                )
            ),
        )

        stub(mapOf("case:internalStatus" to "in-behandeling", "doc:/spoed" to false, "doc:/bedrag" to 1500, "doc:/dossier" to "D-1"))
        assertThat(evaluator.matches(caseId, conditions)).isTrue()

        // the nested allOf fails on its second entry, and spoed is false, so the anyOf fails
        stub(mapOf("case:internalStatus" to "in-behandeling", "doc:/spoed" to false, "doc:/bedrag" to 1500))
        assertThat(evaluator.matches(caseId, conditions)).isFalse()

        // the outer condition fails, so the group no longer matters
        stub(mapOf("case:internalStatus" to "afgehandeld", "doc:/spoed" to true))
        assertThat(evaluator.matches(caseId, conditions)).isFalse()
    }

    @Test
    fun `should resolve every path in the tree in a single call`() {
        stub(mapOf("case:internalStatus" to "in-behandeling", "doc:/spoed" to true))
        val conditions = listOf(
            MigrationCondition("case:internalStatus", "==", "in-behandeling"),
            AnyOfMigrationCondition(
                listOf(
                    MigrationCondition("doc:/spoed", "==", true),
                    // duplicated on purpose: a path is only requested once
                    MigrationCondition("case:internalStatus", "==", "afgehandeld"),
                )
            ),
        )

        evaluator.matches(caseId, conditions)

        verify(valueResolverService).resolveValues(
            caseId.toString(),
            listOf("case:internalStatus", "doc:/spoed"),
        )
    }

    private fun stub(values: Map<String, Any?>) {
        whenever(valueResolverService.resolveValues(any<String>(), any())).thenReturn(values)
    }
}
