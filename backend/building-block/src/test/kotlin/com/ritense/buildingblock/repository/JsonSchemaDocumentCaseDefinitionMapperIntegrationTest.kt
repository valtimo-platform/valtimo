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
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
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
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val jsonSchemaDocumentRepository: JsonSchemaDocumentRepository,
    private val jsonSchemaDocumentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val buildingBlockDefinitionDeploymentService: BuildingBlockDefinitionDeploymentService,
    private val caseDefinitionDeploymentService: CaseDefinitionDeploymentService,
) : BaseIntegrationTest() {

    @Test
    fun `mapQuery should correctly link JsonSchemaDocument to CaseDefinition for building block blueprint`() {
        // 1. Deploy definitions from JSON files
        buildingBlockDefinitionDeploymentService?.deployOnStartup()
        caseDefinitionDeploymentService?.deployOnStartup()

        val bbDefinitionId = BuildingBlockDefinitionId("bezwaar", Semver.parse("1.0.0")!!)

        // 2. Setup JsonSchemaDocument for the building block
        val jsonSchemaDocDefId = JsonSchemaDocumentDefinitionId.forBuildingBlock("bezwaar.schema", bbDefinitionId)
        
        val documentId = UUID.randomUUID()
        val jsonSchemaDocumentId = JsonSchemaDocumentId.newId(documentId)
        
        val documentConstructor = JsonSchemaDocument::class.java.getDeclaredConstructor()
        documentConstructor.isAccessible = true
        val document = documentConstructor.newInstance()
        
        val idField = JsonSchemaDocument::class.java.getDeclaredField("id")
        idField.isAccessible = true
        idField.set(document, jsonSchemaDocumentId)
        document.setDefinitionId(jsonSchemaDocDefId)
        
        jsonSchemaDocumentRepository.save(document)

        // 3. Setup BuildingBlockInstance linking document to case document
        val bbDefinition = buildingBlockDefinitionRepository.findById(bbDefinitionId).get()
        val bbInstance = BuildingBlockInstance(
            id = UUID.randomUUID(),
            documentId = documentId,
            caseDocumentId = UUID.randomUUID(), // Arbitrary case document ID
            activityId = "activity-1",
            definition = bbDefinition
        )
        buildingBlockInstanceRepository.save(bbInstance)

        // 4. Test mapQuery via Specification
        val spec = Specification<JsonSchemaDocument> { root, query, cb ->
            val result: AuthorizationEntityMapperResult<CaseDefinition> = mapper.mapQuery(root, query!!, cb)
            val cd = result.root
            
            // Apply the condition: CaseDefinition.name == "bb-case"
            cb.and(
                result.joinPredicate,
                cb.equal(cd.get<String>("name"), "bb-case")
            )
        }

        val foundDocuments = jsonSchemaDocumentRepository.findAll(spec)

        assertThat(foundDocuments).hasSize(1)
        assertThat(foundDocuments[0].id().id).isEqualTo(documentId)
    }

    @Test
    fun `mapQuery should not find document if case name does not match`() {
        // 1. Deploy definitions from JSON files
        buildingBlockDefinitionDeploymentService?.deployOnStartup()
        caseDefinitionDeploymentService?.deployOnStartup()

        val bbDefinitionId = BuildingBlockDefinitionId("bezwaar", Semver.parse("1.0.0")!!)

        // 2. Setup JsonSchemaDocument
        val jsonSchemaDocDefId = JsonSchemaDocumentDefinitionId.forBuildingBlock("bezwaar.schema", bbDefinitionId)

        val documentId = UUID.randomUUID()
        val jsonSchemaDocumentId = JsonSchemaDocumentId.newId(documentId)
        
        val documentConstructor = JsonSchemaDocument::class.java.getDeclaredConstructor()
        documentConstructor.isAccessible = true
        val document = documentConstructor.newInstance()
        
        val idField = JsonSchemaDocument::class.java.getDeclaredField("id")
        idField.isAccessible = true
        idField.set(document, jsonSchemaDocumentId)
        document.setDefinitionId(jsonSchemaDocDefId)
        
        jsonSchemaDocumentRepository.save(document)

        val bbDefinition = buildingBlockDefinitionRepository.findById(bbDefinitionId).get()
        val bbInstance = BuildingBlockInstance(
            id = UUID.randomUUID(),
            documentId = documentId,
            caseDocumentId = UUID.randomUUID(),
            activityId = "activity-2",
            definition = bbDefinition
        )
        buildingBlockInstanceRepository.save(bbInstance)

        // Search for "non-existent-case" should NOT find anything
        val spec = Specification<JsonSchemaDocument> { root, query, cb ->
            val result = mapper.mapQuery(root, query!!, cb)
            val cd = result.root
            cb.and(
                result.joinPredicate,
                cb.equal(cd.get<String>("name"), "non-existent-case")
            )
        }

        val foundDocuments = jsonSchemaDocumentRepository.findAll(spec)
        assertThat(foundDocuments).isEmpty()
    }
}
