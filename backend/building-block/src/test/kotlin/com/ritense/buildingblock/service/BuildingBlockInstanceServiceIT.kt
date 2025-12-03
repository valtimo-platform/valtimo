/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.ritense.authorization.AuthorizationContext
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.Callable

class BuildingBlockInstanceServiceIT : BaseIntegrationTest() {

    @Autowired
    lateinit var buildingBlockInstanceService: BuildingBlockInstanceService

    @Autowired
    lateinit var buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository

    @Autowired
    lateinit var buildingBlockInstanceRepository: BuildingBlockInstanceRepository

    @Autowired
    lateinit var documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository

    @Autowired
    lateinit var documentService: DocumentService

    @Test
    fun `create should store instance with document id`() {
        val buildingBlockKey = "bezwaar-${UUID.randomUUID().toString().take(8)}"
        val definitionId = BuildingBlockDefinitionId.of(buildingBlockKey, "1.0.0")
        val definition = BuildingBlockDefinition(
            id = definitionId,
            name = "Bezwaar block",
            description = "description",
            createdBy = "tester",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        buildingBlockDefinitionRepository.saveAndFlush(definition)

        val documentDefinitionName = "$buildingBlockKey-document"
        val documentDefinitionId = JsonSchemaDocumentDefinitionId.forBuildingBlock(documentDefinitionName, definitionId)
        val schema = """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "$documentDefinitionName.schema",
              "type": "object",
              "properties": {}
            }
        """.trimIndent()
        documentDefinitionRepository.saveAndFlush(
            JsonSchemaDocumentDefinition(
                documentDefinitionId,
                JsonSchema.fromString(schema)
            )
        )

        val caseDocumentRequest = NewDocumentRequest(
            documentDefinitionName,
            null,
            null,
            definitionId.key,
            definitionId.versionTag.toString(),
            JsonNodeFactory.instance.objectNode().put("type", "case")
        )
        val caseDocumentId = AuthorizationContext.runWithoutAuthorization(Callable {
            val result = documentService.createDocument(caseDocumentRequest)
            val document = result.resultingDocument().orElseThrow { IllegalStateException("Case document not created") }
            document.id().getId()
        })

        val buildingBlockDocumentRequest = NewDocumentRequest(
            documentDefinitionName,
            null,
            null,
            definitionId.key,
            definitionId.versionTag.toString(),
            JsonNodeFactory.instance.objectNode().put("type", "building-block")
        )

        val instance = AuthorizationContext.runWithoutAuthorization(Callable {
            buildingBlockInstanceService.create(buildingBlockDocumentRequest, caseDocumentId)
        })

        assertThat(instance.documentId).isNotNull
        assertThat(instance.caseDocumentId).isEqualTo(caseDocumentId)
        assertThat(instance.definition.id).isEqualTo(definitionId)

        val stored = buildingBlockInstanceRepository.findById(instance.id)
        assertThat(stored).isPresent
        assertThat(stored.get().documentId).isEqualTo(instance.documentId)
    }
}
