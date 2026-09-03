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

import com.ritense.case.domain.group.CaseDefinitionGroupMember
import com.ritense.case.domain.group.CaseDefinitionGroupMemberId
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface CaseDefinitionGroupMemberRepository : JpaRepository<CaseDefinitionGroupMember, CaseDefinitionGroupMemberId> {
    fun findByIdGroupKeyOrderByOrderAsc(groupKey: String): List<CaseDefinitionGroupMember>
    fun deleteByIdGroupKeyAndIdCaseDefinitionKey(groupKey: String, caseDefinitionKey: String)
    fun deleteByIdGroupKey(groupKey: String)

    @Query("SELECT COALESCE(MAX(m.order), 0) FROM CaseDefinitionGroupMember m WHERE m.id.groupKey = :groupKey")
    fun findMaxOrderByGroupKey(groupKey: String): Int

    fun findByIdCaseDefinitionKey(caseDefinitionKey: String): List<CaseDefinitionGroupMember>
}
