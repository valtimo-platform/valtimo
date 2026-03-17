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
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.core.env.Environment
import java.time.LocalDateTime
import java.util.Optional

class CaseDefinitionCheckerImplTest {

    private lateinit var caseDefinitionRepository: CaseDefinitionRepository
    private lateinit var environment: Environment
    private lateinit var configurationIssueRepository: CaseDefinitionConfigurationIssueRepository
    private lateinit var checker: CaseDefinitionCheckerImpl

    private val caseDefinitionId = CaseDefinitionId.of("key", "1.0.0")

    @BeforeEach
    fun setUp() {
        caseDefinitionRepository = mock()
        environment = mock()
        configurationIssueRepository = mock()

        whenever(environment.activeProfiles).thenReturn(arrayOf("dev"))

        checker = CaseDefinitionCheckerImpl(
            caseDefinitionRepository,
            environment,
            "dev,test",
            false,
            configurationIssueRepository,
        )
    }

    @Test
    fun `assertCanUpdateCaseDefinitionConfiguration should allow update on non-final case definition`() {
        val caseDefinition = caseDefinition(final = false)
        whenever(caseDefinitionRepository.findById(caseDefinitionId)).thenReturn(Optional.of(caseDefinition))

        assertDoesNotThrow {
            checker.assertCanUpdateCaseDefinitionConfiguration(caseDefinitionId, "zaak-type-link")
        }
    }

    @Test
    fun `assertCanUpdateCaseDefinitionConfiguration should allow update on final case definition with unresolved issue`() {
        val caseDefinition = caseDefinition(final = true)
        whenever(caseDefinitionRepository.findById(caseDefinitionId)).thenReturn(Optional.of(caseDefinition))
        whenever(configurationIssueRepository.findUnresolvedByCaseDefinitionIdAndIssueType(caseDefinitionId, "zaak-type-link"))
            .thenReturn(CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId,
                issueType = "zaak-type-link"
            ))

        assertDoesNotThrow {
            checker.assertCanUpdateCaseDefinitionConfiguration(caseDefinitionId, "zaak-type-link")
        }
    }

    @Test
    fun `assertCanUpdateCaseDefinitionConfiguration should block update on final case definition without unresolved issue`() {
        val caseDefinition = caseDefinition(final = true)
        whenever(caseDefinitionRepository.findById(caseDefinitionId)).thenReturn(Optional.of(caseDefinition))
        whenever(configurationIssueRepository.findUnresolvedByCaseDefinitionIdAndIssueType(caseDefinitionId, "zaak-type-link"))
            .thenReturn(null)

        assertThrows<IllegalArgumentException> {
            checker.assertCanUpdateCaseDefinitionConfiguration(caseDefinitionId, "zaak-type-link")
        }
    }

    @Test
    fun `assertCanUpdateCaseDefinitionConfiguration should throw when case definition does not exist`() {
        whenever(caseDefinitionRepository.findById(caseDefinitionId)).thenReturn(Optional.empty())

        assertThrows<IllegalStateException> {
            checker.assertCanUpdateCaseDefinitionConfiguration(caseDefinitionId, "zaak-type-link")
        }
    }

    private fun caseDefinition(final: Boolean): CaseDefinition {
        return CaseDefinition(
            id = caseDefinitionId,
            name = "Test",
            description = "description",
            createdBy = "system",
            createdDate = LocalDateTime.now(),
            final = final,
            active = true,
        )
    }
}
