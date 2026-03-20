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

import com.ritense.authorization.AuthorizationEntityMapperResult
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.service.BuildingBlockDefinitionDeploymentService
import com.ritense.case.service.CaseDefinitionDeploymentService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import java.time.LocalDateTime
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
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val jsonSchemaDocumentRepository: JsonSchemaDocumentRepository,
    private val buildingBlockDefinitionDeploymentService: BuildingBlockDefinitionDeploymentService,
    private val caseDefinitionDeploymentService: CaseDefinitionDeploymentService,
) : BaseIntegrationTest() {

    @Test
    fun `mapQuery should correctly link JsonSchemaDocument to CaseDefinition for building block blueprint`() {
        buildingBlockDefinitionDeploymentService?.deployOnStartup()
        caseDefinitionDeploymentService?.deployOnStartup()

        val bbDefinitionId = BuildingBlockDefinitionId("bezwaar", Semver.parse("1.0.0")!!)

        // Create a case document (needed as FK target for BuildingBlockInstance.caseDocumentId)
        val caseDocument = createDocument(
            JsonSchemaDocumentDefinitionId.forCase("bb-case", CaseDefinitionId("bb-case", Semver.parse("1.0.0")!!))
        )

        // Create building block document
        val bbDocument = createDocument(
            JsonSchemaDocumentDefinitionId.forBuildingBlock("bezwaar.schema", bbDefinitionId)
        )

        // Link building block document to case document via BuildingBlockInstance
        val bbDefinition = buildingBlockDefinitionRepository.findById(bbDefinitionId).get()
        val bbInstance = BuildingBlockInstance(
            id = UUID.randomUUID(),
            documentId = bbDocument.id().id,
            caseDocumentId = caseDocument.id().id,
            activityId = "activity-1",
            definition = bbDefinition
        )
        buildingBlockInstanceRepository.save(bbInstance)

        // Test mapQuery via Specification (mimics ContainerPermissionCondition behavior)
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
        buildingBlockDefinitionDeploymentService?.deployOnStartup()
        caseDefinitionDeploymentService?.deployOnStartup()

        val bbDefinitionId = BuildingBlockDefinitionId("bezwaar", Semver.parse("1.0.0")!!)

        val caseDocument = createDocument(
            JsonSchemaDocumentDefinitionId.forCase("bb-case", CaseDefinitionId("bb-case", Semver.parse("1.0.0")!!))
        )

        val bbDocument = createDocument(
            JsonSchemaDocumentDefinitionId.forBuildingBlock("bezwaar.schema", bbDefinitionId)
        )

        val bbDefinition = buildingBlockDefinitionRepository.findById(bbDefinitionId).get()
        val bbInstance = BuildingBlockInstance(
            id = UUID.randomUUID(),
            documentId = bbDocument.id().id,
            caseDocumentId = caseDocument.id().id,
            activityId = "activity-2",
            definition = bbDefinition
        )
        buildingBlockInstanceRepository.save(bbInstance)

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

    private fun createDocument(definitionId: JsonSchemaDocumentDefinitionId): JsonSchemaDocument {
        val constructor = JsonSchemaDocument::class.java.getDeclaredConstructor()
        constructor.isAccessible = true
        val document = constructor.newInstance()

        val idField = JsonSchemaDocument::class.java.getDeclaredField("id")
        idField.isAccessible = true
        idField.set(document, JsonSchemaDocumentId.newId(UUID.randomUUID()))
        document.setDefinitionId(definitionId)

        val createdOnField = JsonSchemaDocument::class.java.getDeclaredField("createdOn")
        createdOnField.isAccessible = true
        createdOnField.set(document, LocalDateTime.now())

        val createdByField = JsonSchemaDocument::class.java.getDeclaredField("createdBy")
        createdByField.isAccessible = true
        createdByField.set(document, "test-user")

        return jsonSchemaDocumentRepository.save(document)
    }
}
