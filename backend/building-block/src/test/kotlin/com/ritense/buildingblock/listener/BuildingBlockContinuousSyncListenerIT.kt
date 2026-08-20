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

package com.ritense.buildingblock.listener

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
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

/**
 * Integration test for [BuildingBlockContinuousSyncListener]. Verifies that output mappings marked
 * [BuildingBlockSyncTiming.CONTINUOUS] are written back to the parent context on every committed
 * write to the building block document, while the building block is still running (before it ends).
 */
@Transactional
class BuildingBlockContinuousSyncListenerIT @Autowired constructor(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val documentService: DocumentService,
    private val processDocumentService: ProcessDocumentService,
    private val processLinkRepository: ProcessLinkRepository,
    private val objectMapper: ObjectMapper,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
) : BaseIntegrationTest() {

    @Test
    fun `should sync continuous output mappings to case document on building block document modification`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList(),
                outputMappings = listOf(
                    BuildingBlockOutputMapping(
                        source = "beslissingBezwaar",
                        target = "doc:/resultFromBb",
                        syncTiming = BuildingBlockSyncTiming.CONTINUOUS
                    )
                )
            )
        )

        val caseDocumentId = startCase(objectMapper.createObjectNode())

        val instance = buildingBlockInstanceRepository.findAll().single()

        // Modify the building block document mid-flight, before the building block completes.
        runWithoutAuthorization {
            val buildingBlockDocument = documentService.get(instance.documentId.toString()) as JsonSchemaDocument
            val updatedContent = buildingBlockDocument.content().asJson().deepCopy<ObjectNode>()
            updatedContent.put("beslissingBezwaar", "approved")
            documentService.modifyDocument(buildingBlockDocument, updatedContent)
        }

        // The building block is still running: it waits for the 'test-ready' message before ending.
        val activeBuildingBlockProcesses = runtimeService.createProcessInstanceQuery()
            .processInstanceBusinessKey(instance.documentId.toString())
            .count()
        assertThat(activeBuildingBlockProcesses).isEqualTo(1)

        // The continuous mapping was already synced to the case document, even though the BB has not ended.
        val caseDocumentBeforeEnd = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        assertThat(caseDocumentBeforeEnd.content().asJson().get("resultFromBb").asText()).isEqualTo("approved")

        runtimeService.correlateMessage("test-ready", instance.documentId.toString())
    }

    @Test
    fun `should not sync END mappings before building block completes`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList(),
                outputMappings = listOf(
                    BuildingBlockOutputMapping(
                        source = "beslissingBezwaar",
                        target = "doc:/syncedContinuous",
                        syncTiming = BuildingBlockSyncTiming.CONTINUOUS
                    ),
                    BuildingBlockOutputMapping(
                        source = "besluit",
                        target = "doc:/syncedEnd",
                        syncTiming = BuildingBlockSyncTiming.END
                    )
                )
            )
        )

        val caseDocumentId = startCase(objectMapper.createObjectNode())

        val instance = buildingBlockInstanceRepository.findAll().single()

        runWithoutAuthorization {
            val buildingBlockDocument = documentService.get(instance.documentId.toString()) as JsonSchemaDocument
            val updatedContent = buildingBlockDocument.content().asJson().deepCopy<ObjectNode>()
            updatedContent.put("beslissingBezwaar", "approved")
            updatedContent.put("besluit", "granted")
            documentService.modifyDocument(buildingBlockDocument, updatedContent)
        }

        // Mid-flight: only the CONTINUOUS mapping has been synced, the END mapping has not.
        val caseDocumentBeforeEnd = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        assertThat(caseDocumentBeforeEnd.content().asJson().get("syncedContinuous").asText()).isEqualTo("approved")
        assertThat(caseDocumentBeforeEnd.content().asJson().has("syncedEnd")).isFalse()

        runtimeService.correlateMessage("test-ready", instance.documentId.toString())

        // After completion: the END mapping has been synced as well.
        val caseDocumentAfterEnd = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        assertThat(caseDocumentAfterEnd.content().asJson().get("syncedContinuous").asText()).isEqualTo("approved")
        assertThat(caseDocumentAfterEnd.content().asJson().get("syncedEnd").asText()).isEqualTo("granted")
    }

    @Test
    fun `should skip continuous mappings whose source is not yet set instead of writing null`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList(),
                outputMappings = listOf(
                    BuildingBlockOutputMapping(
                        source = "beslissingBezwaar",
                        target = "doc:/resultFromBb",
                        syncTiming = BuildingBlockSyncTiming.CONTINUOUS
                    )
                )
            )
        )

        val caseDocumentId = startCase(objectMapper.createObjectNode())
        val instance = buildingBlockInstanceRepository.findAll().single()

        // Modify a DIFFERENT field, so the continuous mapping's source ('beslissingBezwaar') resolves to null.
        // The sync must skip it (not write null, which would fail schema validation and abort this write).
        runWithoutAuthorization {
            val bb = documentService.get(instance.documentId.toString()) as JsonSchemaDocument
            val updated = bb.content().asJson().deepCopy<ObjectNode>()
            updated.put("besluit", "irrelevant")
            documentService.modifyDocument(bb, updated)
        }

        val caseDocAfterUnsetSource = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        assertThat(caseDocAfterUnsetSource.content().asJson().has("resultFromBb")).isFalse()

        // Now set the source; the next modification should sync the real value.
        runWithoutAuthorization {
            val bb = documentService.get(instance.documentId.toString()) as JsonSchemaDocument
            val updated = bb.content().asJson().deepCopy<ObjectNode>()
            updated.put("beslissingBezwaar", "approved")
            documentService.modifyDocument(bb, updated)
        }

        val caseDocAfterSetSource = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        assertThat(caseDocAfterSetSource.content().asJson().get("resultFromBb").asText()).isEqualTo("approved")

        runtimeService.correlateMessage("test-ready", instance.documentId.toString())
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
        private const val CALL_ACTIVITY_ID = "callActivity"
    }
}
