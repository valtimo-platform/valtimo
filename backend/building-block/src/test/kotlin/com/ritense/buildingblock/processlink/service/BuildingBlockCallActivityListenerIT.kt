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
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.processlink.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.service.DocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.beans.factory.annotation.Autowired
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.Callable

class BuildingBlockCallActivityListenerIT @Autowired constructor(
    private val listener: BuildingBlockCallActivityListener,
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val documentService: DocumentService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @Test
    fun `should create building block document with resolved case data`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(
            "test-bb",
            "1.0.0"
        )
        buildingBlockDefinitionRepository.save(
            BuildingBlockDefinition(
                id = buildingBlockDefinitionId,
                name = "Test Building Block",
                description = "integration test block",
                createdBy = "tester",
                createdDate = LocalDateTime.now(),
            )
        )

        val caseDefinitionId = CaseDefinitionId.of(
            "test-case",
            "1.0.0"
        )
        val caseDocumentDefinitionName = "test-case"
        val caseSchema = """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "$caseDocumentDefinitionName.schema",
              "type": "object",
              "properties": {
                "contact": {
                  "type": "object",
                  "properties": {
                    "email": {"type": "string"},
                    "age": {"type": "integer"}
                  }
                }
              }
            }
        """.trimIndent()
        documentDefinitionRepository.saveAndFlush(
            JsonSchemaDocumentDefinition(
                JsonSchemaDocumentDefinitionId.forCase(caseDocumentDefinitionName, caseDefinitionId),
                JsonSchema.fromString(caseSchema)
            )
        )

        val buildingBlockDocumentDefinitionName = "test-bb"
        val buildingBlockSchema = """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "$buildingBlockDocumentDefinitionName.schema",
              "type": "object",
              "properties": {
                "emailCopy": {"type": "string"},
                "ageCopy": {"type": "integer"}
              }
            }
        """.trimIndent()
        documentDefinitionRepository.saveAndFlush(
            JsonSchemaDocumentDefinition(
                JsonSchemaDocumentDefinitionId.forBuildingBlock(
                    buildingBlockDocumentDefinitionName,
                    buildingBlockDefinitionId
                ),
                JsonSchema.fromString(buildingBlockSchema)
            )
        )

        val caseContent = objectMapper.createObjectNode().apply {
            putObject("contact").apply {
                put("email", "henk@example.com")
                put("age", 84)
            }
        }

        val caseDocumentId = runWithoutAuthorization {
            val result = documentService.createDocument(
                NewDocumentRequest(
                    caseDocumentDefinitionName,
                    caseDefinitionId.key,
                    caseDefinitionId.versionTag.toString(),
                    caseContent
                )
            )
            result.resultingDocument()
                .orElseThrow { IllegalStateException("Case document not created") }
                .id()
                .getId()
        }

        val inputMappings = listOf(
            BuildingBlockInputMapping(
                source = "doc:/contact/email",
                target = "emailCopy"
            ),
            BuildingBlockInputMapping(
                source = "doc:/contact/age",
                target = "ageCopy"
            ),
        )
        val processLink = BuildingBlockProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "case-process",
            activityId = "callActivity",
            activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
            buildingBlockDefinitionId = buildingBlockDefinitionId,
            pluginConfigurationMappings = emptyMap(),
            inputMappings = inputMappings
        )
        whenever(processLinkService.getProcessLinks("case-process", "callActivity")).thenReturn(listOf(processLink))

        val execution = mock<DelegateExecution> {
            on { currentActivityId } doReturn "callActivity"
            on { processDefinitionId } doReturn "case-process"
            on { businessKey } doReturn caseDocumentId.toString()
        }

        AuthorizationContext.runWithoutAuthorization(Callable {
            listener.onCallActivityStart(execution)
        })

        val instances = buildingBlockInstanceRepository.findAll()
        assertThat(instances).hasSize(1)
        val instance = instances.first()
        assertThat(instance.caseDocumentId).isEqualTo(caseDocumentId)
        assertThat(instance.definition.id).isEqualTo(buildingBlockDefinitionId)

        val buildingBlockDocument = AuthorizationContext.runWithoutAuthorization(Callable {
            documentService.get(instance.documentId.toString())
        }) as JsonSchemaDocument
        val content = buildingBlockDocument.content().asJson()
        assertThat(content.get("emailCopy").asText()).isEqualTo("henk@example.com")
        assertThat(content.get("ageCopy").asInt()).isEqualTo(84)
    }
}
