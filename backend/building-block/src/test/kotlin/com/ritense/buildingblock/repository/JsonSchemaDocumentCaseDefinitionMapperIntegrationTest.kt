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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationEntityMapperResult
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.semver4j.Semver
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.jpa.domain.Specification
import org.springframework.transaction.annotation.Transactional

@Transactional
class JsonSchemaDocumentCaseDefinitionMapperIntegrationTest @Autowired constructor(
    private val mapper: JsonSchemaDocumentCaseDefinitionMapper,
    private val buildingBlockInstanceService: BuildingBlockInstanceService,
    private val jsonSchemaDocumentRepository: JsonSchemaDocumentRepository,
    private val documentService: DocumentService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @Test
    fun `mapQuery should correctly link JsonSchemaDocument to CaseDefinition for building block blueprint`() {
        val caseDocument = createCaseDocument()
        val bbDocument = createBuildingBlockDocument(caseDocument.id().id)

        val spec = Specification<JsonSchemaDocument> { root, query, cb ->
            val result: AuthorizationEntityMapperResult<CaseDefinition> = mapper.mapQuery(root, query!!, cb)
            val cd = result.root
            val sub = result.query as jakarta.persistence.criteria.Subquery<*>

            val existing = sub.restriction
            val caseCondition = cb.equal(cd.get<String>("name"), "bb-case")
            val predicates = listOfNotNull(existing, caseCondition).toTypedArray()
            sub.where(*predicates)

            result.joinPredicate
        }

        val foundDocuments = jsonSchemaDocumentRepository.findAll(spec)

        val foundIds = foundDocuments.map { it.id().id }
        assertThat(foundIds).contains(bbDocument.id().id)
        assertThat(foundIds).contains(caseDocument.id().id)
    }

    @Test
    fun `mapQuery should not find document if case name does not match`() {
        val caseDocument = createCaseDocument()
        createBuildingBlockDocument(caseDocument.id().id)

        val spec = Specification<JsonSchemaDocument> { root, query, cb ->
            val result = mapper.mapQuery(root, query!!, cb)
            val cd = result.root
            val sub = result.query as jakarta.persistence.criteria.Subquery<*>

            val existing = sub.restriction
            val caseCondition = cb.equal(cd.get<String>("name"), "non-existent-case")
            val predicates = listOfNotNull(existing, caseCondition).toTypedArray()
            sub.where(*predicates)

            result.joinPredicate
        }

        val foundDocuments = jsonSchemaDocumentRepository.findAll(spec)
        assertThat(foundDocuments).isEmpty()
    }

    private fun createCaseDocument(): JsonSchemaDocument {
        return runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    "bb-case.schema",
                    "bb-case",
                    "1.0.0",
                    objectMapper.readTree("{}")
                )
            ).resultingDocument().orElseThrow() as JsonSchemaDocument
        }
    }

    private fun createBuildingBlockDocument(caseDocumentId: UUID): JsonSchemaDocument {
        return runWithoutAuthorization {
            val bbInstance = buildingBlockInstanceService.create(
                NewDocumentRequest(
                    "bezwaar.schema",
                    null,
                    null,
                    "bezwaar",
                    "1.0.0",
                    objectMapper.readTree("{}")
                ),
                caseDocumentId,
                "activity-1",
            )
            documentService.get(bbInstance.documentId.toString()) as JsonSchemaDocument
        }
    }
}
