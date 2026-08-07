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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockSyncTiming
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.CaseCorrelationService
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
 * Integration test for starting building blocks by message. A case pins a specific building-block
 * version, so [CaseCorrelationService] starts the main process definition the link points at rather
 * than letting the engine pick the latest deployed version of the process definition key.
 */
@Transactional
class BuildingBlockMessageStartIT @Autowired constructor(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val caseCorrelationService: CaseCorrelationService,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val documentService: DocumentService,
    private val objectMapper: ObjectMapper,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
) : BaseIntegrationTest() {

    @Test
    fun `should start a linked building block through its message start event`() {
        linkNotifyBuildingBlock(NOTIFY_VERSION)
        val caseDocumentId = createCaseDocument()

        val processInstances = caseCorrelationService.sendStartMessageToCase(
            START_MESSAGE,
            caseDocumentId.toString(),
            mapOf("messagePayload" to "from-case")
        )

        assertThat(processInstances).hasSize(1)
        val instance = buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId).single()
        assertThat(instance.caseDocumentId).isEqualTo(caseDocumentId)
        assertThat(instance.documentId).isNotEqualTo(caseDocumentId)
        assertThat(instance.definition.id).isEqualTo(notifyDefinitionId(NOTIFY_VERSION))

        // The building-block bootstrap rewrote the business key from the case to the BB document.
        val runningInstance = runtimeService.createProcessInstanceQuery()
            .processInstanceId(instance.processInstanceId!!)
            .singleResult()
        assertThat(runningInstance.businessKey).isEqualTo(instance.documentId.toString())
        assertThat(runtimeService.getVariable(instance.processInstanceId!!, "messagePayload"))
            .isEqualTo("from-case")
    }

    @Test
    fun `should apply the input mappings of the case definition link to the new building block document`() {
        linkNotifyBuildingBlock(NOTIFY_VERSION)
        val caseDocumentId = createCaseDocument(firstName = "Jan")

        caseCorrelationService.sendStartMessageToCase(START_MESSAGE, caseDocumentId.toString())

        val instance = buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId).single()
        val buildingBlockDocument = runWithoutAuthorization {
            documentService.get(instance.documentId.toString())
        } as JsonSchemaDocument
        assertThat(buildingBlockDocument.content().asJson().get("notificationText").asText()).isEqualTo("Jan")
    }

    @Test
    fun `should sync the output mappings back to the case when the started building block ends`() {
        linkNotifyBuildingBlock(NOTIFY_VERSION)
        val caseDocumentId = createCaseDocument(firstName = "Jan")

        caseCorrelationService.sendStartMessageToCase(START_MESSAGE, caseDocumentId.toString())

        val instance = buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId).single()
        runWithoutAuthorization {
            runtimeService.correlateMessage(READY_MESSAGE, instance.documentId.toString())
        }

        val caseDocument = runWithoutAuthorization {
            documentService.get(caseDocumentId.toString())
        } as JsonSchemaDocument
        assertThat(caseDocument.content().asJson().get("resultFromBb").asText()).isEqualTo("Jan")
    }

    @Test
    fun `should start the building block version the case link pins, not the latest deployed one`() {
        linkNotifyBuildingBlock(NOTIFY_VERSION)
        val caseDocumentId = createCaseDocument()
        val pinnedProcessDefinitionId = notifyProcessDefinitionId(NOTIFY_VERSION)
        val latestProcessDefinitionId = notifyProcessDefinitionId(NOTIFY_NEWER_VERSION)
        assertThat(pinnedProcessDefinitionId).isNotEqualTo(latestProcessDefinitionId)

        val processInstances = caseCorrelationService.sendStartMessageToCase(START_MESSAGE, caseDocumentId.toString())

        assertThat(processInstances).hasSize(1)
        assertThat(processInstances.single().processDefinitionId).isEqualTo(pinnedProcessDefinitionId)
    }

    @Test
    fun `should not start anything for a message no linked building block declares`() {
        linkNotifyBuildingBlock(NOTIFY_VERSION)
        val caseDocumentId = createCaseDocument()

        val processInstances = caseCorrelationService.sendStartMessageToCase(
            "message-nobody-declares",
            caseDocumentId.toString()
        )

        assertThat(processInstances).isEmpty()
        assertThat(buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)).isEmpty()
        assertThat(runningInstanceCount(NOTIFY_PROCESS_KEY)).isZero()
    }

    @Test
    fun `should not start a linked building block whose main process has no message start event`() {
        linkNotifyBuildingBlock(NOTIFY_VERSION)
        linkBezwaarBuildingBlock()
        val caseDocumentId = createCaseDocument()

        caseCorrelationService.sendStartMessageToCase(START_MESSAGE, caseDocumentId.toString())

        val instances = buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)
        assertThat(instances).hasSize(1)
        assertThat(instances.single().definition.id.key).isEqualTo(NOTIFY_KEY)
        assertThat(runningInstanceCount(BEZWAAR_PROCESS_KEY)).isZero()
    }

    @Test
    fun `should start a building block from a case process through the bpmn expression`() {
        linkNotifyBuildingBlock(NOTIFY_VERSION)
        val caseDocumentId = createCaseDocument()

        runWithoutAuthorization {
            runtimeService.startProcessInstanceByKey(
                SENDER_PROCESS_KEY,
                caseDocumentId.toString(),
                emptyMap()
            )
        }

        val instance = buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId).single()
        assertThat(instance.definition.id).isEqualTo(notifyDefinitionId(NOTIFY_VERSION))
    }

    private fun linkNotifyBuildingBlock(versionTag: String) {
        ensureMainProcessLink(notifyDefinitionId(versionTag), NOTIFY_PROCESS_KEY)
        caseDefinitionBuildingBlockLinkRepository.save(
            CaseDefinitionBuildingBlockLink(
                caseDefinitionId = CaseDefinitionId.of(CASE_DEFINITION_KEY, CASE_DEFINITION_VERSION),
                buildingBlockDefinitionId = notifyDefinitionId(versionTag),
                inputMappings = listOf(
                    BuildingBlockInputMapping(source = "doc:/contact/firstName", target = "/notificationText")
                ),
                outputMappings = listOf(
                    BuildingBlockOutputMapping(
                        source = "doc:/notificationText",
                        target = "doc:/resultFromBb",
                        syncTiming = BuildingBlockSyncTiming.END
                    )
                ),
            )
        )
    }

    private fun linkBezwaarBuildingBlock() {
        val bezwaarDefinitionId = BuildingBlockDefinitionId.of(BEZWAAR_KEY, BEZWAAR_VERSION)
        ensureMainProcessLink(bezwaarDefinitionId, BEZWAAR_PROCESS_KEY)
        caseDefinitionBuildingBlockLinkRepository.save(
            CaseDefinitionBuildingBlockLink(
                caseDefinitionId = CaseDefinitionId.of(CASE_DEFINITION_KEY, CASE_DEFINITION_VERSION),
                buildingBlockDefinitionId = bezwaarDefinitionId,
                inputMappings = emptyList(),
                outputMappings = emptyList(),
            )
        )
    }

    /** The notify link maps `contact.firstName` into the BB document, which requires a string. */
    private fun createCaseDocument(firstName: String = "Jan"): UUID {
        val content = objectMapper.createObjectNode()
        content.putObject("contact").put("firstName", firstName)
        return runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    CASE_DEFINITION_KEY,
                    CASE_DEFINITION_KEY,
                    CASE_DEFINITION_VERSION,
                    content as ObjectNode
                )
            ).resultingDocument()
                .orElseThrow { IllegalStateException("Case document not created") }
                .id()
                .getId()
        }
    }

    private fun notifyDefinitionId(versionTag: String) = BuildingBlockDefinitionId.of(NOTIFY_KEY, versionTag)

    /**
     * Recreates the main-process link of a deployed building block when it is missing. Other
     * (non-transactional) integration tests in this module clear
     * `process_definition_building_block_definition`, so the deployed state cannot be relied upon.
     */
    private fun ensureMainProcessLink(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        processDefinitionKey: String
    ) {
        if (
            processDefinitionBuildingBlockDefinitionRepository
                .findByIdBuildingBlockDefinitionIdAndMain(buildingBlockDefinitionId, true) != null
        ) {
            return
        }
        processDefinitionBuildingBlockDefinitionRepository.save(
            ProcessDefinitionBuildingBlockDefinition(
                id = ProcessDefinitionBuildingBlockDefinitionId(
                    processDefinitionId = ProcessDefinitionId.of(
                        processDefinitionId(buildingBlockDefinitionId, processDefinitionKey)
                    ),
                    buildingBlockDefinitionId = buildingBlockDefinitionId,
                ),
                main = true,
            )
        )
    }

    private fun notifyProcessDefinitionId(versionTag: String): String =
        processDefinitionId(notifyDefinitionId(versionTag), NOTIFY_PROCESS_KEY)

    private fun processDefinitionId(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        processDefinitionKey: String
    ): String {
        val versionTag = "BB:${buildingBlockDefinitionId.key}:${buildingBlockDefinitionId.versionTag}"
        return repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(processDefinitionKey)
            .versionTag(versionTag)
            .orderByProcessDefinitionVersion()
            .desc()
            .list()
            .firstOrNull()
            ?.id
            ?: throw IllegalStateException("Process '$processDefinitionKey' ($versionTag) not deployed")
    }

    private fun runningInstanceCount(processDefinitionKey: String): Int {
        return runtimeService.createProcessInstanceQuery()
            .processDefinitionKey(processDefinitionKey)
            .list()
            .size
    }

    companion object {
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val NOTIFY_KEY = "notify"
        private const val NOTIFY_VERSION = "1.0.0"
        private const val NOTIFY_NEWER_VERSION = "1.1.0"
        private const val NOTIFY_PROCESS_KEY = "notify-process"
        private const val BEZWAAR_KEY = "bezwaar"
        private const val BEZWAAR_VERSION = "1.0.0"
        private const val BEZWAAR_PROCESS_KEY = "building-block-process"
        private const val SENDER_PROCESS_KEY = "case-start-message-sender"
        private const val START_MESSAGE = "case-notification"
        private const val READY_MESSAGE = "test-ready"
    }
}
