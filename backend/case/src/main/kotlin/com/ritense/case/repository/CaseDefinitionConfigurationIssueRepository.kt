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

import com.ritense.case.domain.CaseDefinitionConfigurationIssue
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface CaseDefinitionConfigurationIssueRepository : JpaRepository<CaseDefinitionConfigurationIssue, UUID> {

    @Query("""
        SELECT i FROM CaseDefinitionConfigurationIssue i
        WHERE i.caseDefinitionId.key = :#{#caseDefinitionId.key}
        AND i.caseDefinitionId.versionTag = :#{#caseDefinitionId.versionTag}
        AND i.resolved = false
    """)
    fun findUnresolvedByCaseDefinitionId(
        @Param("caseDefinitionId") caseDefinitionId: CaseDefinitionId
    ): List<CaseDefinitionConfigurationIssue>

    @Query("""
        SELECT i FROM CaseDefinitionConfigurationIssue i
        WHERE i.caseDefinitionId.key = :#{#caseDefinitionId.key}
        AND i.caseDefinitionId.versionTag = :#{#caseDefinitionId.versionTag}
    """)
    fun findAllByCaseDefinitionId(
        @Param("caseDefinitionId") caseDefinitionId: CaseDefinitionId
    ): List<CaseDefinitionConfigurationIssue>

    @Query("""
        SELECT i FROM CaseDefinitionConfigurationIssue i
        WHERE i.caseDefinitionId.key = :#{#caseDefinitionId.key}
        AND i.caseDefinitionId.versionTag = :#{#caseDefinitionId.versionTag}
        AND i.issueType = :issueType
        AND i.resolved = false
    """)
    fun findUnresolvedByCaseDefinitionIdAndIssueType(
        @Param("caseDefinitionId") caseDefinitionId: CaseDefinitionId,
        @Param("issueType") issueType: String
    ): CaseDefinitionConfigurationIssue?

    @Modifying
    @Query("""
        DELETE FROM CaseDefinitionConfigurationIssue i
        WHERE i.caseDefinitionId.key = :#{#caseDefinitionId.key}
        AND i.caseDefinitionId.versionTag = :#{#caseDefinitionId.versionTag}
    """)
    fun deleteByCaseDefinitionId(
        @Param("caseDefinitionId") caseDefinitionId: CaseDefinitionId
    )

    @Query("""
        SELECT DISTINCT i.caseDefinitionId FROM CaseDefinitionConfigurationIssue i
        WHERE i.caseDefinitionId IN :caseDefinitionIds
        AND i.resolved = false
    """)
    fun findCaseDefinitionIdsWithUnresolvedIssues(
        @Param("caseDefinitionIds") caseDefinitionIds: Collection<CaseDefinitionId>
    ): Set<CaseDefinitionId>
}
