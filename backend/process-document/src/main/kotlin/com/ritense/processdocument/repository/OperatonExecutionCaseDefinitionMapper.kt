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
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.ChainedAuthorizationEntityMapper
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Root
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class OperatonExecutionCaseDefinitionMapper(
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val caseDefinitionService: CaseDefinitionService,
    private val authorizationService: AuthorizationService,
) : AuthorizationEntityMapper<OperatonExecution, CaseDefinition> {

    private var chainedMapper: ChainedAuthorizationEntityMapper<OperatonExecution, JsonSchemaDocument, CaseDefinition>? =
        null

    override fun mapRelated(entity: OperatonExecution): List<CaseDefinition> {
        if (entity.processDefinition != null) {
            val link = processDefinitionCaseDefinitionRepository.findByIdProcessDefinitionId(
                ProcessDefinitionId(entity.processDefinition!!.id),
            )
            if (link != null) {
                listOf(caseDefinitionService.getCaseDefinition(link.id.caseDefinitionId))
            }
        }
        return getChainedMapper()?.mapRelated(entity) ?: emptyList()
    }

    override fun mapQuery(
        root: Root<OperatonExecution>,
        query: AbstractQuery<*>,
        cb: CriteriaBuilder
    ): AuthorizationEntityMapperResult<CaseDefinition> {

        val subA = query.subquery(Int::class.java)
        val cdA = subA.from(CaseDefinition::class.java)
        val pdcd = subA.from(ProcessDefinitionCaseDefinition::class.java)

        val pd = root.join<OperatonExecution, OperatonProcessDefinition>("processDefinition")

        subA.select(cb.literal(1))
            .where(
                cb.and(
                    cb.equal(
                        pd.get<String>("id"),
                        pdcd.get<Any>("id").get<Any>("processDefinitionId").get<String>("id")
                    ),
                    cb.equal(
                        cdA.get<String>("id"),
                        pdcd.get<Any>("id").get<String>("caseDefinitionId")
                    )
                )
            )

        val predicateA = cb.exists(subA)
        val predicateB = getChainedMapper()?.mapQuery(root, query, cb)?.joinPredicate
        val finalPredicate = if (predicateB != null) {
            cb.or(predicateA, predicateB)
        } else {
            predicateA
        }

        return AuthorizationEntityMapperResult(
            cdA,
            subA,
            finalPredicate
        )
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean {
        return fromClass == OperatonExecution::class.java && toClass == CaseDefinition::class.java
    }

    private fun getChainedMapper(): ChainedAuthorizationEntityMapper<OperatonExecution, JsonSchemaDocument, CaseDefinition>? {
        if (chainedMapper == null) {
            chainedMapper = authorizationService.buildChainedMapper(
                OperatonExecution::class.java,
                JsonSchemaDocument::class.java,
                CaseDefinition::class.java
            )
        }
        return chainedMapper
    }
}