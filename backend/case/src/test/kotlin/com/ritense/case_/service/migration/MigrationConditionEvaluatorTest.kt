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
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
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

    private fun stub(values: Map<String, Any?>) {
        whenever(valueResolverService.resolveValues(any<String>(), any())).thenReturn(values)
    }
}
