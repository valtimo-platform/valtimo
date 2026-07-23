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
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Integration test for [BuildingBlockEndEventListener]. Verifies that, when a building block
 * is started ad-hoc as a case action (i.e. the BB's main process is started directly with the
 * case document as business key, not via a call activity), the output mappings configured on
 * the [CaseDefinitionBuildingBlockLink] are written back to the case document after the BB
 * process completes.
 */
@Transactional
class BuildingBlockEndEventListenerIT @Autowired constructor(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val documentService: DocumentService,
    private val objectMapper: ObjectMapper,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
    private val processDocumentService: ProcessDocumentService,
    private val processLinkRepository: ProcessLinkRepository,
) : BaseIntegrationTest() {

    @Test
    fun `should write output mappings to case document when ad-hoc building block ends`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
        val caseDefinitionId = CaseDefinitionId.of(CASE_DEFINITION_KEY, CASE_DEFINITION_VERSION)

        caseDefinitionBuildingBlockLinkRepository.save(
            CaseDefinitionBuildingBlockLink(
                caseDefinitionId = caseDefinitionId,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                inputMappings = emptyList(),
                outputMappings = listOf(
                    BuildingBlockOutputMapping(
                        source = "doc:/beslissingBezwaar",
                        target = "doc:/resultFromBb",
                        syncTiming = BuildingBlockSyncTiming.END
                    )
                ),
            )
        )

        val caseDocumentId = createCaseDocument()

        runWithoutAuthorization {
            runtimeService.startProcessInstanceByKey(
                BUILDING_BLOCK_PROCESS_KEY,
                caseDocumentId.toString(),
                emptyMap()
            )
        }

        val instance = buildingBlockInstanceRepository.findAll().single()
        assertThat(instance.caseDocumentId).isEqualTo(caseDocumentId)
        assertThat(instance.definition.id).isEqualTo(buildingBlockDefinitionId)
        // Sanity check: started as an ad-hoc case action, not via a call activity
        assertThat(instance.callerProcessDefinitionId).isNull()

        runWithoutAuthorization {
            val bbDocument = documentService.get(instance.documentId.toString()) as JsonSchemaDocument
            val updatedContent = bbDocument.content().asJson().deepCopy<ObjectNode>()
            updatedContent.put("beslissingBezwaar", "approved")
            documentService.modifyDocument(bbDocument, updatedContent)
        }

        runWithoutAuthorization {
            runtimeService.correlateMessage("test-ready", instance.documentId.toString())
        }

        val updatedCaseDocument = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        assertThat(updatedCaseDocument.content().asJson().get("resultFromBb").asText()).isEqualTo("approved")
    }

    @Test
    fun `should not throw when ad-hoc building block has no output mappings`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
        val caseDefinitionId = CaseDefinitionId.of(CASE_DEFINITION_KEY, CASE_DEFINITION_VERSION)

        caseDefinitionBuildingBlockLinkRepository.save(
            CaseDefinitionBuildingBlockLink(
                caseDefinitionId = caseDefinitionId,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                inputMappings = emptyList(),
                outputMappings = emptyList(),
            )
        )

        val caseDocumentId = createCaseDocument()

        runWithoutAuthorization {
            runtimeService.startProcessInstanceByKey(
                BUILDING_BLOCK_PROCESS_KEY,
                caseDocumentId.toString(),
                emptyMap()
            )
        }

        val instance = buildingBlockInstanceRepository.findAll().single()
        runWithoutAuthorization {
            runtimeService.correlateMessage("test-ready", instance.documentId.toString())
        }

        val updatedCaseDocument = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        assertThat(updatedCaseDocument.content().asJson().has("resultFromBb")).isFalse()
    }

    @Test
    fun `should not sync case_definition output mappings when building block is started via call activity`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
        val caseDefinitionId = CaseDefinitionId.of(CASE_DEFINITION_KEY, CASE_DEFINITION_VERSION)

        // Case-definition link declares output mappings — these MUST be ignored for call-activity-started BBs,
        // because BuildingBlockCallActivityListener.onCallActivityEnd is responsible for the sync in that case.
        caseDefinitionBuildingBlockLinkRepository.save(
            CaseDefinitionBuildingBlockLink(
                caseDefinitionId = caseDefinitionId,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                inputMappings = emptyList(),
                outputMappings = listOf(
                    BuildingBlockOutputMapping(
                        source = "doc:/beslissingBezwaar",
                        target = "doc:/resultFromBb",
                        syncTiming = BuildingBlockSyncTiming.END
                    )
                ),
            )
        )

        val callActivityProcessDefinitionId = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(CALL_ACTIVITY_MAIN_PROCESS_KEY)
            .latestVersion()
            .singleResult()
            ?.id
            ?: throw IllegalStateException("Process definition '$CALL_ACTIVITY_MAIN_PROCESS_KEY' not deployed")

        // Process link has no output mappings, so the call-activity listener won't write anything either —
        // any value appearing on the case document could only come from BuildingBlockEndEventListener.
        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = callActivityProcessDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList(),
                outputMappings = emptyList(),
            )
        )

        val caseDocumentId = runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(
                NewDocumentAndStartProcessRequest(
                    CALL_ACTIVITY_MAIN_PROCESS_KEY,
                    NewDocumentRequest(
                        CASE_DEFINITION_KEY,
                        CASE_DEFINITION_KEY,
                        CASE_DEFINITION_VERSION,
                        objectMapper.createObjectNode()
                    )
                )
            )
        }.resultingDocument()
            .orElseThrow { IllegalStateException("Case document not created") }
            .id()
            .getId()

        val instance = buildingBlockInstanceRepository.findAll().single()
        // Sanity check: this BB was started via a call activity
        assertThat(instance.callerProcessDefinitionId).isEqualTo(callActivityProcessDefinitionId)

        runWithoutAuthorization {
            val bbDocument = documentService.get(instance.documentId.toString()) as JsonSchemaDocument
            val updatedContent = bbDocument.content().asJson().deepCopy<ObjectNode>()
            updatedContent.put("beslissingBezwaar", "approved")
            documentService.modifyDocument(bbDocument, updatedContent)
        }

        runWithoutAuthorization {
            runtimeService.correlateMessage("test-ready", instance.documentId.toString())
        }

        val updatedCaseDocument = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        assertThat(updatedCaseDocument.content().asJson().has("resultFromBb")).isFalse()
    }

    private fun createCaseDocument(): UUID {
        // Ensure the case process is deployed (BPMN files are autoloaded via the application config).
        repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(BUILDING_BLOCK_PROCESS_KEY)
            .latestVersion()
            .singleResult()
            ?: throw IllegalStateException("Process definition '$BUILDING_BLOCK_PROCESS_KEY' not deployed")

        val caseContent = objectMapper.createObjectNode()
        return runWithoutAuthorization {
            val result = documentService.createDocument(
                NewDocumentRequest(
                    CASE_DEFINITION_KEY,
                    CASE_DEFINITION_KEY,
                    CASE_DEFINITION_VERSION,
                    caseContent
                )
            )
            result.resultingDocument()
                .orElseThrow { IllegalStateException("Case document not created") }
                .id()
                .getId()
        }
    }

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val BUILDING_BLOCK_PROCESS_KEY = "building-block-process"
        private const val CALL_ACTIVITY_MAIN_PROCESS_KEY = "building-block-call-activity-main"
        private const val CALL_ACTIVITY_ID = "callActivity"
    }
}
