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

package com.ritense.processdocument.repository

import com.ritense.authorization.AuthorizationEntityMapper
import com.ritense.authorization.AuthorizationEntityMapperResult
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Root
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class OperatonProcessDefinitionCaseDefinitionMapper(
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val caseDefinitionService: CaseDefinitionService,
) : AuthorizationEntityMapper<OperatonProcessDefinition, CaseDefinition> {

    override fun mapRelated(entity: OperatonProcessDefinition): List<CaseDefinition> {
        val link = processDefinitionCaseDefinitionRepository.findByIdProcessDefinitionId(
            ProcessDefinitionId(entity.id),
        ) ?: return emptyList()
        return listOf(caseDefinitionService.getCaseDefinition(link.id.caseDefinitionId))
    }

    override fun mapQuery(
        root: Root<OperatonProcessDefinition>,
        query: AbstractQuery<*>,
        cb: CriteriaBuilder
    ): AuthorizationEntityMapperResult<CaseDefinition> {

        val sub = query.subquery(Int::class.java)
        val cd = sub.from(CaseDefinition::class.java)
        val cdId = cd.get<Any>("id")

        val pdcd = sub.from(ProcessDefinitionCaseDefinition::class.java)

        sub.select(cb.literal(1)).where(
            cb.and(
                cb.equal(
                    root.get<String>("id"),
                    pdcd.get<Any>("id").get<Any>("processDefinitionId").get<String>("id")
                ),
                cb.equal(
                    cdId,
                    pdcd.get<Any>("id").get<String>("caseDefinitionId")
                )
            )
        )

        return AuthorizationEntityMapperResult(cd, sub, cb.exists(sub))
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean {
        return fromClass == OperatonProcessDefinition::class.java && toClass == CaseDefinition::class.java
    }
}
