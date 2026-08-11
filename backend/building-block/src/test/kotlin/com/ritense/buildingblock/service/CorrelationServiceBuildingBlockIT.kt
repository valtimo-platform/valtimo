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
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.repository.ProcessDocumentInstanceRepository
import com.ritense.processdocument.service.CorrelationService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.HistoryService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Integration test for case-scoped message correlation towards building blocks. A building-block
 * process instance runs under its own document id as business key, so the case business key alone
 * never reaches it — [CorrelationService] fans the message out over the case and all of its
 * building-block instances.
 */
@Transactional
class CorrelationServiceBuildingBlockIT @Autowired constructor(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val correlationService: CorrelationService,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val documentService: DocumentService,
    private val objectMapper: ObjectMapper,
    private val historyService: HistoryService,
    private val processDocumentInstanceRepository: ProcessDocumentInstanceRepository,
    private val runtimeService: RuntimeService,
) : BaseIntegrationTest() {

    @Test
    fun `should deliver a message to the running building block of a case`() {
        linkBuildingBlockToCaseDefinition()
        val caseDocumentId = createCaseDocument()
        val instance = startAdHocBuildingBlock(caseDocumentId)

        val results = correlationService.sendCatchEventMessageToCase(TEST_MESSAGE, caseDocumentId.toString())

        assertThat(results).hasSize(1)
        assertThat(isRunning(instance.processInstanceId!!)).isFalse()
    }

    @Test
    fun `should deliver a message to every building block instance of a case`() {
        linkBuildingBlockToCaseDefinition()
        val caseDocumentId = createCaseDocument()
        val instanceOne = startAdHocBuildingBlock(caseDocumentId)
        val instanceTwo = startAdHocBuildingBlock(caseDocumentId)
        assertThat(instanceOne.documentId).isNotEqualTo(instanceTwo.documentId)

        val results = correlationService.sendCatchEventMessageToCase(TEST_MESSAGE, caseDocumentId.toString())

        assertThat(results).hasSize(2)
        assertThat(isRunning(instanceOne.processInstanceId!!)).isFalse()
        assertThat(isRunning(instanceTwo.processInstanceId!!)).isFalse()
    }

    @Test
    fun `should not deliver a message to building blocks of another case`() {
        linkBuildingBlockToCaseDefinition()
        val targetCaseDocumentId = createCaseDocument()
        val otherCaseDocumentId = createCaseDocument()
        val targetInstance = startAdHocBuildingBlock(targetCaseDocumentId)
        val otherInstance = startAdHocBuildingBlock(otherCaseDocumentId)

        val results = correlationService.sendCatchEventMessageToCase(TEST_MESSAGE, targetCaseDocumentId.toString())

        assertThat(results).hasSize(1)
        assertThat(isRunning(targetInstance.processInstanceId!!)).isFalse()
        assertThat(isRunning(otherInstance.processInstanceId!!)).isTrue()
    }

    @Test
    fun `should accept a building block document id and resolve it to the owning case`() {
        linkBuildingBlockToCaseDefinition()
        val caseDocumentId = createCaseDocument()
        val instance = startAdHocBuildingBlock(caseDocumentId)

        val results = correlationService.sendCatchEventMessageToCase(TEST_MESSAGE, instance.documentId.toString())

        assertThat(results).hasSize(1)
        assertThat(isRunning(instance.processInstanceId!!)).isFalse()
    }

    @Test
    fun `should set variables on the receiving building block process`() {
        linkBuildingBlockToCaseDefinition()
        val caseDocumentId = createCaseDocument()
        val instance = startAdHocBuildingBlock(caseDocumentId)
        val processInstanceId = instance.processInstanceId!!

        correlationService.sendCatchEventMessageToCase(
            TEST_MESSAGE,
            caseDocumentId.toString(),
            mapOf("messagePayload" to "from-case")
        )

        val variable = historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(processInstanceId)
            .variableName("messagePayload")
            .singleResult()
        assertThat(variable?.value).isEqualTo("from-case")
    }

    @Test
    fun `should not associate a building block process with the case document`() {
        linkBuildingBlockToCaseDefinition()
        val caseDocumentId = createCaseDocument()
        val instance = startAdHocBuildingBlock(caseDocumentId)

        correlationService.sendCatchEventMessageToCase(TEST_MESSAGE, caseDocumentId.toString())

        val caseAssociations = processDocumentInstanceRepository
            .findAllByProcessDocumentInstanceIdDocumentId(JsonSchemaDocumentId.existingId(caseDocumentId))
        assertThat(caseAssociations.map { it.processDocumentInstanceId().processInstanceId().toString() })
            .doesNotContain(instance.processInstanceId)
    }

    @Test
    fun `should return an empty result when nothing in the case is subscribed`() {
        linkBuildingBlockToCaseDefinition()
        val caseDocumentId = createCaseDocument()
        startAdHocBuildingBlock(caseDocumentId)

        val results = correlationService.sendCatchEventMessageToCase("no-one-listens-to-this", caseDocumentId.toString())

        assertThat(results).isEmpty()
    }

    @Test
    fun `should deliver a message thrown from a case process through the bpmn expression`() {
        linkBuildingBlockToCaseDefinition()
        val caseDocumentId = createCaseDocument()
        val instance = startAdHocBuildingBlock(caseDocumentId)

        runWithoutAuthorization {
            runtimeService.startProcessInstanceByKey(
                SENDER_PROCESS_KEY,
                caseDocumentId.toString(),
                emptyMap()
            )
        }

        assertThat(isRunning(instance.processInstanceId!!)).isFalse()
    }

    private fun linkBuildingBlockToCaseDefinition() {
        caseDefinitionBuildingBlockLinkRepository.save(
            CaseDefinitionBuildingBlockLink(
                caseDefinitionId = CaseDefinitionId.of(CASE_DEFINITION_KEY, CASE_DEFINITION_VERSION),
                buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION),
                inputMappings = emptyList(),
                outputMappings = emptyList(),
            )
        )
    }

    private fun createCaseDocument(): UUID {
        return runWithoutAuthorization {
            documentService.createDocument(
                NewDocumentRequest(
                    CASE_DEFINITION_KEY,
                    CASE_DEFINITION_KEY,
                    CASE_DEFINITION_VERSION,
                    objectMapper.createObjectNode()
                )
            ).resultingDocument()
                .orElseThrow { IllegalStateException("Case document not created") }
                .id()
                .getId()
        }
    }

    /** Starts the building block as a case action and returns its freshly created instance. */
    private fun startAdHocBuildingBlock(caseDocumentId: UUID): BuildingBlockInstance {
        val known = buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId).map { it.id }
        runWithoutAuthorization {
            runtimeService.startProcessInstanceByKey(
                BUILDING_BLOCK_PROCESS_KEY,
                caseDocumentId.toString(),
                emptyMap()
            )
        }
        return buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)
            .single { it.id !in known }
    }

    private fun isRunning(processInstanceId: String): Boolean {
        return runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult() != null
    }

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val BUILDING_BLOCK_PROCESS_KEY = "building-block-process"
        private const val SENDER_PROCESS_KEY = "case-message-sender"
        private const val TEST_MESSAGE = "test-ready"
    }
}
