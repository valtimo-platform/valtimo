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
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class BuildingBlockCallActivityListenerIT @Autowired constructor(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val documentService: DocumentService,
    private val processDocumentService: ProcessDocumentService,
    private val processLinkRepository: ProcessLinkRepository,
    private val objectMapper: ObjectMapper,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
) : BaseIntegrationTest() {

    @Test
    fun `should create building block document with resolved case data`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        val caseContent = objectMapper.createObjectNode().apply {
            putObject("contact").apply {
                put("firstName", "Ada")
                put("lastName", "Lovelace")
            }
        }

        val inputMappings = listOf(
            BuildingBlockInputMapping(
                source = "doc:/contact/firstName",
                target = "voornaam"
            ),
            BuildingBlockInputMapping(
                source = "doc:/contact/lastName",
                target = "achternaam"
            ),
        )
        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = inputMappings
            )
        )

        val caseDocumentId = startCase(caseContent)

        val instances = buildingBlockInstanceRepository.findAll()
        assertThat(instances).hasSize(1)
        val instance = instances.first()
        assertThat(instance.caseDocumentId).isEqualTo(caseDocumentId)
        assertThat(instance.definition.id).isEqualTo(buildingBlockDefinitionId)

        val buildingBlockDocument = runWithoutAuthorization {
            documentService.get(instance.documentId.toString())
        } as JsonSchemaDocument
        val content = buildingBlockDocument.content().asJson()
        assertThat(content.get("voornaam").asText()).isEqualTo("Ada")
        assertThat(content.get("achternaam").asText()).isEqualTo("Lovelace")

        runtimeService.correlateMessage("test-ready", instance.documentId.toString())
    }

    @Test
    fun `should write output mappings to case document on call activity end`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
        val caseContent = objectMapper.createObjectNode()

        val outputMappings = listOf(
            BuildingBlockOutputMapping(
                source = "beslissingBezwaar",
                target = "doc:/resultFromBb",
                syncTiming = BuildingBlockSyncTiming.END
            ),
        )
        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList(),
                outputMappings = outputMappings
            )
        )

        val caseDocumentId = startCase(caseContent)

        val instances = buildingBlockInstanceRepository.findAll()
        assertThat(instances).hasSize(1)
        val instance = instances.first()

        runWithoutAuthorization {
            val buildingBlockDocument = documentService.get(instance.documentId.toString()) as JsonSchemaDocument
            val updatedContent = buildingBlockDocument.content().asJson().deepCopy<ObjectNode>()
            updatedContent.put("beslissingBezwaar", "approved")
            documentService.modifyDocument(buildingBlockDocument, updatedContent)
        }

        runtimeService.correlateMessage("test-ready", instance.documentId.toString())

        val updatedCaseDocument = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        val content = updatedCaseDocument.content().asJson()
        assertThat(content.get("resultFromBb").asText()).isEqualTo("approved")
    }

    private fun startCase(caseContent: ObjectNode): UUID {
        val request = NewDocumentAndStartProcessRequest(
            MAIN_PROCESS_KEY,
            NewDocumentRequest(
                CASE_DOCUMENT_DEFINITION_NAME,
                CASE_DEFINITION_KEY,
                CASE_DEFINITION_VERSION,
                caseContent
            )
        )
        val result = runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(request)
        }
        return result.resultingDocument()
            .orElseThrow { IllegalStateException("Case document not created") }
            .id()
            .getId()
    }

    private fun processDefinitionId(): String {
        val definition = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(MAIN_PROCESS_KEY)
            .latestVersion()
            .singleResult()
            ?: throw IllegalStateException("Process definition '$MAIN_PROCESS_KEY' not deployed")
        return definition.id
    }

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val CASE_DOCUMENT_DEFINITION_NAME = "bb-case"
        private const val MAIN_PROCESS_KEY = "building-block-call-activity-main"
        private const val SUB_PROCESS_KEY = "building-block-process"
        private const val CALL_ACTIVITY_ID = "callActivity"
    }
}
