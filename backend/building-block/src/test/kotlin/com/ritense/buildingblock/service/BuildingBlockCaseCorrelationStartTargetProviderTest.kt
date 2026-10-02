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

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.document.domain.Document
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito.RETURNS_DEEP_STUBS
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.Message
import org.operaton.bpm.model.bpmn.instance.MessageEventDefinition
import org.operaton.bpm.model.bpmn.instance.StartEvent
import java.util.UUID

class BuildingBlockCaseCorrelationStartTargetProviderTest {

    private lateinit var documentService: DocumentService
    private lateinit var caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository
    private lateinit var processDefinitionBuildingBlockDefinitionRepository:
        ProcessDefinitionBuildingBlockDefinitionRepository
    private lateinit var repositoryService: RepositoryService
    private lateinit var provider: BuildingBlockCaseCorrelationStartTargetProvider

    private val caseDocumentId: UUID = UUID.randomUUID()
    private val caseDefinitionId: CaseDefinitionId = CaseDefinitionId.of("bb-case", "1.0.0")
    private val buildingBlockDefinitionId: BuildingBlockDefinitionId =
        BuildingBlockDefinitionId.of("notify", "1.0.0")
    private val processDefinitionId = "notify-process:1:${UUID.randomUUID()}"

    @BeforeEach
    fun setUp() {
        documentService = mock()
        caseDefinitionBuildingBlockLinkRepository = mock()
        processDefinitionBuildingBlockDefinitionRepository = mock()
        repositoryService = mock()

        provider = BuildingBlockCaseCorrelationStartTargetProvider(
            documentService,
            caseDefinitionBuildingBlockLinkRepository,
            processDefinitionBuildingBlockDefinitionRepository,
            repositoryService,
        )

        val document = mock<Document>(defaultAnswer = RETURNS_DEEP_STUBS)
        whenever(document.definitionId().caseDefinitionId()).thenReturn(caseDefinitionId)
        whenever(documentService.get(caseDocumentId.toString())).thenReturn(document)
    }

    @Test
    fun `should return the pinned main process definition when it declares the message start event`() {
        linkBuildingBlock()
        mockMainProcessDefinition(processDefinitionId)
        mockBpmnModel(processDefinitionId, messageStartEventName = MESSAGE)

        assertThat(provider.getStartTargets(caseDocumentId, MESSAGE)).containsExactly(processDefinitionId)
    }

    @Test
    fun `should not return a main process that declares a different message start event`() {
        linkBuildingBlock()
        mockMainProcessDefinition(processDefinitionId)
        mockBpmnModel(processDefinitionId, messageStartEventName = "some-other-message")

        assertThat(provider.getStartTargets(caseDocumentId, MESSAGE)).isEmpty()
    }

    @Test
    fun `should not return a main process without a message start event`() {
        linkBuildingBlock()
        mockMainProcessDefinition(processDefinitionId)
        mockBpmnModel(processDefinitionId, messageStartEventName = null)

        assertThat(provider.getStartTargets(caseDocumentId, MESSAGE)).isEmpty()
    }

    @Test
    fun `should skip building blocks without a main process definition`() {
        linkBuildingBlock()
        whenever(
            processDefinitionBuildingBlockDefinitionRepository
                .findByIdBuildingBlockDefinitionIdAndMain(eq(buildingBlockDefinitionId), eq(true))
        ).thenReturn(null)

        assertThat(provider.getStartTargets(caseDocumentId, MESSAGE)).isEmpty()
    }

    @Test
    fun `should return no targets when the case definition has no building block links`() {
        whenever(caseDefinitionBuildingBlockLinkRepository.findAllByCaseDefinitionId(caseDefinitionId))
            .thenReturn(emptyList())

        assertThat(provider.getStartTargets(caseDocumentId, MESSAGE)).isEmpty()
    }

    @Test
    fun `should skip a main process whose bpmn model cannot be read`() {
        linkBuildingBlock()
        mockMainProcessDefinition(processDefinitionId)
        whenever(repositoryService.getBpmnModelInstance(processDefinitionId)).thenReturn(null)

        assertThat(provider.getStartTargets(caseDocumentId, MESSAGE)).isEmpty()
    }

    private fun linkBuildingBlock() {
        val link = CaseDefinitionBuildingBlockLink(
            caseDefinitionId = caseDefinitionId,
            buildingBlockDefinitionId = buildingBlockDefinitionId,
            inputMappings = emptyList(),
            outputMappings = emptyList(),
        )
        whenever(caseDefinitionBuildingBlockLinkRepository.findAllByCaseDefinitionId(caseDefinitionId))
            .thenReturn(listOf(link))
    }

    private fun mockMainProcessDefinition(processDefinitionId: String) {
        val mainProcessDefinition = ProcessDefinitionBuildingBlockDefinition(
            id = ProcessDefinitionBuildingBlockDefinitionId(
                processDefinitionId = ProcessDefinitionId.of(processDefinitionId),
                buildingBlockDefinitionId = buildingBlockDefinitionId,
            ),
            main = true,
        )
        whenever(
            processDefinitionBuildingBlockDefinitionRepository
                .findByIdBuildingBlockDefinitionIdAndMain(eq(buildingBlockDefinitionId), eq(true))
        ).thenReturn(mainProcessDefinition)
    }

    private fun mockBpmnModel(processDefinitionId: String, messageStartEventName: String?) {
        whenever(repositoryService.getBpmnModelInstance(processDefinitionId))
            .thenReturn(bpmnModel(messageStartEventName))
    }

    private fun bpmnModel(messageStartEventName: String?): BpmnModelInstance {
        val model = Bpmn.createExecutableProcess("notify-process")
            .startEvent("start")
            .endEvent()
            .done()
        if (messageStartEventName != null) {
            val startEvent = model.getModelElementById<StartEvent>("start")
            val message = model.newInstance(Message::class.java)
            message.name = messageStartEventName
            model.definitions.addChildElement(message)
            val messageEventDefinition = model.newInstance(MessageEventDefinition::class.java)
            messageEventDefinition.message = message
            startEvent.addChildElement(messageEventDefinition)
        }
        return model
    }

    private companion object {
        private const val MESSAGE = "case-notification"
    }
}
