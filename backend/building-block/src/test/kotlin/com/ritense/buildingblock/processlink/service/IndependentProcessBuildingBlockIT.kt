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
import com.ritense.document.service.DocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.HistoryService
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Integration test for building blocks started from independent processes (not under a case).
 *
 * Tests that:
 * - Input mappings can read from process variables (pv:) and write to building block document fields
 * - Output mappings can read from building block document fields and write to process variables (pv:)
 */
@Transactional
class IndependentProcessBuildingBlockIT @Autowired constructor(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val documentService: DocumentService,
    private val processLinkRepository: ProcessLinkRepository,
    private val objectMapper: ObjectMapper,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
    private val historyService: HistoryService,
) : BaseIntegrationTest() {

    @Test
    fun `should create building block document with data from process variables`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        // Input mappings: pv:firstName -> voornaam, pv:lastName -> achternaam
        val inputMappings = listOf(
            BuildingBlockInputMapping(
                source = "pv:firstName",
                target = "voornaam"
            ),
            BuildingBlockInputMapping(
                source = "pv:lastName",
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

        // Start independent process with process variables
        val processVariables = mapOf(
            "firstName" to "Ada",
            "lastName" to "Lovelace"
        )
        val processInstance = runtimeService.startProcessInstanceByKey(
            INDEPENDENT_PROCESS_KEY,
            processVariables
        )

        val instances = buildingBlockInstanceRepository.findAll()
        assertThat(instances).hasSize(1)
        val instance = instances.first()
        assertThat(instance.definition.id).isEqualTo(buildingBlockDefinitionId)

        // Verify building block document has the values from process variables
        val buildingBlockDocument = runWithoutAuthorization {
            documentService.get(instance.documentId.toString())
        } as JsonSchemaDocument
        val content = buildingBlockDocument.content().asJson()
        assertThat(content.get("voornaam").asText()).isEqualTo("Ada")
        assertThat(content.get("achternaam").asText()).isEqualTo("Lovelace")

        // Complete the building block process
        runtimeService.correlateMessage("test-ready", instance.documentId.toString())
    }

    @Test
    fun `should write output mappings to process variables on call activity end`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        // Output mappings: beslissingBezwaar -> pv:result
        val outputMappings = listOf(
            BuildingBlockOutputMapping(
                source = "beslissingBezwaar",
                target = "pv:result",
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

        // Start independent process
        val processInstance = runtimeService.startProcessInstanceByKey(INDEPENDENT_PROCESS_KEY)

        val instances = buildingBlockInstanceRepository.findAll()
        assertThat(instances).hasSize(1)
        val instance = instances.first()

        // Update building block document with result
        runWithoutAuthorization {
            val buildingBlockDocument = documentService.get(instance.documentId.toString()) as JsonSchemaDocument
            val updatedContent = buildingBlockDocument.content().asJson().deepCopy<ObjectNode>()
            updatedContent.put("beslissingBezwaar", "approved")
            documentService.modifyDocument(buildingBlockDocument, updatedContent)
        }

        runtimeService.correlateMessage("test-ready", instance.documentId.toString())

        // Use history since process completed
        val result = historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(processInstance.id)
            .variableName("result")
            .singleResult()
        assertThat(result.value).isEqualTo("approved")
    }

    @Test
    fun `should handle both input from pv and output to pv in independent process`() {
        val processDefinitionId = processDefinitionId()
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        // Input mappings: pv:inputName -> voornaam
        val inputMappings = listOf(
            BuildingBlockInputMapping(
                source = "pv:inputName",
                target = "voornaam"
            ),
        )
        // Output mappings: beslissingBezwaar -> pv:outputResult
        val outputMappings = listOf(
            BuildingBlockOutputMapping(
                source = "beslissingBezwaar",
                target = "pv:outputResult",
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
                inputMappings = inputMappings,
                outputMappings = outputMappings
            )
        )

        // Start independent process with input process variable
        val processVariables = mapOf("inputName" to "TestInput")
        val processInstance = runtimeService.startProcessInstanceByKey(
            INDEPENDENT_PROCESS_KEY,
            processVariables
        )

        val instances = buildingBlockInstanceRepository.findAll()
        assertThat(instances).hasSize(1)
        val instance = instances.first()

        // Verify input was mapped to building block document
        val buildingBlockDocument = runWithoutAuthorization {
            documentService.get(instance.documentId.toString())
        } as JsonSchemaDocument
        assertThat(buildingBlockDocument.content().asJson().get("voornaam").asText()).isEqualTo("TestInput")

        // Update building block document with output result
        runWithoutAuthorization {
            val doc = documentService.get(instance.documentId.toString()) as JsonSchemaDocument
            val updatedContent = doc.content().asJson().deepCopy<ObjectNode>()
            updatedContent.put("beslissingBezwaar", "processed")
            documentService.modifyDocument(doc, updatedContent)
        }

        runtimeService.correlateMessage("test-ready", instance.documentId.toString())

        // Use history since process completed
        val outputResult = historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(processInstance.id)
            .variableName("outputResult")
            .singleResult()
        assertThat(outputResult.value).isEqualTo("processed")
    }

    private fun processDefinitionId(): String {
        val definition = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(INDEPENDENT_PROCESS_KEY)
            .latestVersion()
            .singleResult()
            ?: throw IllegalStateException("Process definition '$INDEPENDENT_PROCESS_KEY' not deployed")
        return definition.id
    }

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val INDEPENDENT_PROCESS_KEY = "independent-process-with-bb"
        private const val CALL_ACTIVITY_ID = "callActivity"
    }
}
