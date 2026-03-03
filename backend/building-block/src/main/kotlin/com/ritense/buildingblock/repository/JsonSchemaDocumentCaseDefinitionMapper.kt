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

package com.ritense.buildingblock.repository

import com.ritense.authorization.AuthorizationEntityMapper
import com.ritense.authorization.AuthorizationEntityMapperResult
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Root
import jakarta.persistence.criteria.Subquery
import java.util.UUID
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class JsonSchemaDocumentCaseDefinitionMapper(
    private val caseDocumentResolver: CaseDocumentResolver,
    private val documentService: JsonSchemaDocumentService,
    private val caseDefinitionService: CaseDefinitionService,
) : AuthorizationEntityMapper<JsonSchemaDocument, CaseDefinition> {

    override fun mapRelated(entity: JsonSchemaDocument): List<CaseDefinition> {
        val documentId = caseDocumentResolver.resolveCaseDocumentId(entity.id().id)
        val document = documentService.get(documentId)
        val caseDefinition = caseDefinitionService.getCaseDefinition(document.definitionId().caseDefinitionId())
        return listOf(caseDefinition)
    }

    override fun mapQuery(
        root: Root<JsonSchemaDocument>,
        query: AbstractQuery<*>,
        cb: CriteriaBuilder
    ): AuthorizationEntityMapperResult<CaseDefinition> {

        val sub: Subquery<Int> = when (query) {
            is Subquery<*> -> query as Subquery<Int>
            else -> query.subquery(Int::class.java)
        }

        val doc = if (query is Subquery<*>) root else sub.correlate(root)

        val bpId = doc.get<Any>("documentDefinitionId").get<Any>("blueprintId")

        val cd = sub.from(CaseDefinition::class.java)
        val cdId = cd.get<Any>("id")

        val bbiSub = sub.subquery(Int::class.java)

        val docInBbi = bbiSub.correlate(doc)
        val cdInBbi = bbiSub.correlate(cd)

        val docIdInBbi = docInBbi.get<Any>("id").get<UUID>("id")
        val cdIdInBbi = cdInBbi.get<Any>("id")

        val bbi = bbiSub.from(BuildingBlockInstance::class.java)
        val bbd = bbi.join<BuildingBlockInstance, BuildingBlockDefinition>("definition")
        val bbdId = bbd.get<Any>("id")

        bbiSub.select(cb.literal(1))
            .where(
                cb.and(
                    cb.equal(bbi.get<UUID>("documentId"), docIdInBbi),
                    cb.equal(bbdId.get<String>("key"), cdIdInBbi.get<String>("key")),
                    cb.equal(bbdId.get<String>("versionTag"), cdIdInBbi.get<String>("versionTag"))
                )
            )

        val branchA = cb.and(
            cb.equal(bpId.get<String>("blueprintType"), BlueprintType.CASE.name),
            cb.equal(bpId.get<String>("blueprintKey"), cdId.get<String>("key")),
            cb.equal(bpId.get<String>("blueprintVersionTag"), cdId.get<String>("versionTag"))
        )

        val branchB = cb.and(
            cb.equal(bpId.get<String>("blueprintType"), BlueprintType.BUILDING_BLOCK.name),
            cb.exists(bbiSub)
        )

        val predicate = cb.or(branchA, branchB)

        sub.select(cb.literal(1))

        return AuthorizationEntityMapperResult(
            cd,
            sub,
            predicate
        )
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean {
        return fromClass == JsonSchemaDocument::class.java && toClass == CaseDefinition::class.java
    }
}