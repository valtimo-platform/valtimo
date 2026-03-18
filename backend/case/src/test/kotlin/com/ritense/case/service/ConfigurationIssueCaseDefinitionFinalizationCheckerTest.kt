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

package com.ritense.case.service

import com.ritense.case.domain.CaseDefinitionConfigurationIssue
import com.ritense.case.repository.CaseDefinitionConfigurationIssueRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class ConfigurationIssueCaseDefinitionFinalizationCheckerTest {

    lateinit var repository: CaseDefinitionConfigurationIssueRepository
    lateinit var checker: ConfigurationIssueCaseDefinitionFinalizationChecker

    private val caseDefinitionId = CaseDefinitionId("test-case", "1.0.0")

    @BeforeEach
    fun setUp() {
        repository = mock()
        checker = ConfigurationIssueCaseDefinitionFinalizationChecker(repository)
    }

    @Test
    fun `check should return not finalizable when unresolved issues exist`() {
        whenever(repository.findUnresolvedByCaseDefinitionId(caseDefinitionId))
            .thenReturn(listOf(
                CaseDefinitionConfigurationIssue(
                    caseDefinitionId = caseDefinitionId,
                    issueType = "test-issue"
                )
            ))

        val result = checker.check(caseDefinitionId)

        assertThat(result.finalizable).isFalse()
        assertThat(result.code).isEqualTo("CONFIGURATION_ISSUES")
    }

    @Test
    fun `check should return finalizable when no unresolved issues`() {
        whenever(repository.findUnresolvedByCaseDefinitionId(caseDefinitionId))
            .thenReturn(emptyList())

        val result = checker.check(caseDefinitionId)

        assertThat(result.finalizable).isTrue()
        assertThat(result.code).isEqualTo("OK")
    }
}
