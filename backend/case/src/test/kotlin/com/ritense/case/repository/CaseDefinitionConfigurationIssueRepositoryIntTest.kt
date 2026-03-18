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

package com.ritense.case.repository

import com.ritense.BaseIntegrationTest
import com.ritense.case.domain.CaseDefinitionConfigurationIssue
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Transactional
class CaseDefinitionConfigurationIssueRepositoryIntTest @Autowired constructor(
    private val configurationIssueRepository: CaseDefinitionConfigurationIssueRepository
) : BaseIntegrationTest() {

    private val caseDefinitionId1 = CaseDefinitionId("test-case-1", "1.0.0")
    private val caseDefinitionId2 = CaseDefinitionId("test-case-2", "1.0.0")

    @BeforeEach
    fun cleanUp() {
        configurationIssueRepository.deleteAll()
    }

    @Test
    fun `findUnresolvedByCaseDefinitionId should return only unresolved issues`() {
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId1,
                issueType = "type-a",
                resolved = false
            )
        )
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId1,
                issueType = "type-b",
                resolved = true,
                resolvedAt = LocalDateTime.now()
            )
        )

        val result = configurationIssueRepository.findUnresolvedByCaseDefinitionId(caseDefinitionId1)

        assertThat(result).hasSize(1)
        assertThat(result[0].issueType).isEqualTo("type-a")
        assertThat(result[0].resolved).isFalse()
    }

    @Test
    fun `findAllByCaseDefinitionId should return all issues regardless of resolved status`() {
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId1,
                issueType = "type-a",
                resolved = false
            )
        )
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId1,
                issueType = "type-b",
                resolved = true,
                resolvedAt = LocalDateTime.now()
            )
        )

        val result = configurationIssueRepository.findAllByCaseDefinitionId(caseDefinitionId1)

        assertThat(result).hasSize(2)
    }

    @Test
    fun `findUnresolvedByCaseDefinitionIdAndIssueType should return matching unresolved issue`() {
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId1,
                issueType = "type-a",
                resolved = false
            )
        )
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId1,
                issueType = "type-b",
                resolved = false
            )
        )

        val result = configurationIssueRepository.findUnresolvedByCaseDefinitionIdAndIssueType(
            caseDefinitionId1, "type-a"
        )

        assertThat(result).isNotNull
        assertThat(result!!.issueType).isEqualTo("type-a")
    }

    @Test
    fun `findUnresolvedByCaseDefinitionIdAndIssueType should return null when only resolved issue exists`() {
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId1,
                issueType = "type-a",
                resolved = true,
                resolvedAt = LocalDateTime.now()
            )
        )

        val result = configurationIssueRepository.findUnresolvedByCaseDefinitionIdAndIssueType(
            caseDefinitionId1, "type-a"
        )

        assertThat(result).isNull()
    }

    @Test
    fun `deleteByCaseDefinitionId should delete all issues for case definition`() {
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId1,
                issueType = "type-a"
            )
        )
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId1,
                issueType = "type-b"
            )
        )

        configurationIssueRepository.deleteByCaseDefinitionId(caseDefinitionId1)

        val result = configurationIssueRepository.findAllByCaseDefinitionId(caseDefinitionId1)
        assertThat(result).isEmpty()
    }

    @Test
    fun `findCaseDefinitionIdsWithUnresolvedIssues should return only IDs with unresolved issues`() {
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId1,
                issueType = "type-a",
                resolved = false
            )
        )
        configurationIssueRepository.save(
            CaseDefinitionConfigurationIssue(
                caseDefinitionId = caseDefinitionId2,
                issueType = "type-a",
                resolved = true,
                resolvedAt = LocalDateTime.now()
            )
        )

        val result = configurationIssueRepository.findCaseDefinitionIdsWithUnresolvedIssues(
            listOf(caseDefinitionId1, caseDefinitionId2)
        )

        assertThat(result).containsOnly(caseDefinitionId1)
    }
}
