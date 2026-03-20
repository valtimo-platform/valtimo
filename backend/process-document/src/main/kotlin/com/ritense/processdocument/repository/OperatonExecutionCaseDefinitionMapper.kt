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
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.JoinType
import jakarta.persistence.criteria.Root
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class OperatonExecutionCaseDefinitionMapper(
    private val processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository,
    private val caseDefinitionService: CaseDefinitionService,
    private val executionDocumentMapper: OperatonExecutionJsonSchemaDocumentMapper,
    private val authorizationService: AuthorizationService,
    private val queryDialectHelper: QueryDialectHelper,
) : AuthorizationEntityMapper<OperatonExecution, CaseDefinition> {

    override fun mapRelated(entity: OperatonExecution): List<CaseDefinition> {
        // Path A: via ProcessDefinitionCaseDefinition
        if (entity.processDefinition != null) {
            val link = processDefinitionCaseDefinitionRepository.findByIdProcessDefinitionId(
                ProcessDefinitionId(entity.processDefinition!!.id),
            )
            if (link != null) {
                return listOf(caseDefinitionService.getCaseDefinition(link.id.caseDefinitionId))
            }
        }
        // Path B: via Document → CaseDefinition (supports both CASE and BUILDING_BLOCK blueprints)
        val documents = executionDocumentMapper.mapRelated(entity)
        val docCdMapper = authorizationService.getMapper(JsonSchemaDocument::class.java, CaseDefinition::class.java)
        return documents.flatMap { doc -> docCdMapper.mapRelated(doc) }
    }

    override fun mapQuery(
        root: Root<OperatonExecution>,
        query: AbstractQuery<*>,
        cb: CriteriaBuilder
    ): AuthorizationEntityMapperResult<CaseDefinition> {

        val sub = query.subquery(Int::class.java)
        val cd = sub.from(CaseDefinition::class.java)
        val cdId = cd.get<Any>("id")

        val pd = root.join<OperatonExecution, OperatonProcessDefinition>("processDefinition", JoinType.LEFT)

        // Path A: via ProcessDefinitionCaseDefinition (cross-join in same subquery)
        val pdcd = sub.from(ProcessDefinitionCaseDefinition::class.java)
        val predicateA = cb.and(
            cb.equal(
                pd.get<String>("id"),
                pdcd.get<Any>("id").get<Any>("processDefinitionId").get<String>("id")
            ),
            cb.equal(
                cdId,
                pdcd.get<Any>("id").get<String>("caseDefinitionId")
            )
        )

        // Path B: via Document with CASE blueprint type (cross-join in same subquery)
        val doc = sub.from(JsonSchemaDocument::class.java)
        val bpId = doc.get<Any>("documentDefinitionId").get<Any>("blueprintId")
        val predicateB = cb.and(
            cb.equal(
                root.get<String>("businessKey"),
                queryDialectHelper.uuidToString(cb, doc.get<JsonSchemaDocumentId>("id").get("id"))
            ),
            cb.equal(bpId.get<String>("blueprintType"), BlueprintType.CASE.name),
            cb.equal(bpId.get<String>("blueprintKey"), cdId.get<String>("key")),
            cb.equal(bpId.get<String>("blueprintVersionTag"), cdId.get<String>("versionTag"))
        )

        sub.select(cb.literal(1)).where(cb.or(predicateA, predicateB))

        return AuthorizationEntityMapperResult(cd, sub, cb.exists(sub))
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean {
        return fromClass == OperatonExecution::class.java && toClass == CaseDefinition::class.java
    }
}
