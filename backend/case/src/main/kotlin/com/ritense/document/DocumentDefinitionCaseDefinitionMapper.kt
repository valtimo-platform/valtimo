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

package com.ritense.document

import com.ritense.authorization.AuthorizationEntityMapper
import com.ritense.authorization.AuthorizationEntityMapperResult
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.valtimo.contract.blueprint.BlueprintType
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Root

class DocumentDefinitionCaseDefinitionMapper(
    private val caseDefinitionService: CaseDefinitionService,
) : AuthorizationEntityMapper<JsonSchemaDocumentDefinition, CaseDefinition> {

    override fun mapRelated(entity: JsonSchemaDocumentDefinition): List<CaseDefinition> {
        val caseDefinitionId = entity.id().caseDefinitionId() ?: return emptyList()
        return listOf(caseDefinitionService.getCaseDefinition(caseDefinitionId))
    }

    override fun mapQuery(
        root: Root<JsonSchemaDocumentDefinition>,
        query: AbstractQuery<*>,
        criteriaBuilder: CriteriaBuilder
    ): AuthorizationEntityMapperResult<CaseDefinition> {

        val subquery = query.subquery(Int::class.java)
        val cd = subquery.from(CaseDefinition::class.java)
        val cdId = cd.get<Any>("id")

        val bpId = root.get<Any>("id").get<Any>("blueprintId")

        subquery.select(criteriaBuilder.literal(1)).where(
            criteriaBuilder.and(
                criteriaBuilder.equal(bpId.get<String>("blueprintType"), BlueprintType.CASE.name),
                criteriaBuilder.equal(bpId.get<String>("blueprintKey"), cdId.get<String>("key")),
                criteriaBuilder.equal(bpId.get<String>("blueprintVersionTag"), cdId.get<String>("versionTag"))
            )
        )

        return AuthorizationEntityMapperResult(
            cd,
            subquery,
            criteriaBuilder.exists(subquery)
        )
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean {
        return fromClass == JsonSchemaDocumentDefinition::class.java && toClass == CaseDefinition::class.java
    }
}
