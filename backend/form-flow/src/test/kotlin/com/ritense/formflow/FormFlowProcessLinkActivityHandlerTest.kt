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

package com.ritense.formflow

import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.form.domain.FormDisplayType
import com.ritense.form.domain.FormSizes
import com.ritense.formflow.domain.FormFlowProcessLink
import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.domain.instance.FormFlowInstance
import com.ritense.formflow.domain.instance.FormFlowInstanceId
import com.ritense.formflow.service.FormFlowService
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.operaton.domain.OperatonExecution
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import java.util.Optional
import java.util.UUID
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.operaton.bpm.engine.runtime.ProcessInstanceQuery

/**
 * Covers the blueprint sources [FormFlowProcessLinkActivityHandler] uses to turn a bare
 * `form_flow_definition_key` on a process link into a single form flow definition. The key alone is not
 * an identifier: the same key can exist under several blueprints.
 */
class FormFlowProcessLinkActivityHandlerTest {

    private lateinit var formFlowService: FormFlowService
    private lateinit var repositoryService: OperatonRepositoryService
    private lateinit var processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService
    private lateinit var documentService: DocumentService
    private lateinit var runtimeService: RuntimeService
    private lateinit var handler: FormFlowProcessLinkActivityHandler

    private lateinit var processDefinition: OperatonProcessDefinition
    private lateinit var task: OperatonTask
    private lateinit var formFlowDefinition: FormFlowDefinition

    @BeforeEach
    fun setUp() {
        formFlowService = mock()
        repositoryService = mock()
        processDefinitionCaseDefinitionService = mock()
        documentService = mock()
        runtimeService = mock()
        handler = FormFlowProcessLinkActivityHandler(
            formFlowService,
            repositoryService,
            processDefinitionCaseDefinitionService,
            documentService,
            runtimeService,
        )

        processDefinition = mock()
        whenever(processDefinition.id).thenReturn(PROCESS_DEFINITION_ID)
        whenever(repositoryService.findProcessDefinitionById(PROCESS_DEFINITION_ID)).thenReturn(processDefinition)

        whenever(formFlowService.findInstances(any())).thenReturn(emptyList())

        // A form flow task inside a call-activity subprocess: only the root execution carries the
        // business key, so the document id has to be walked up the execution tree.
        val rootExecution: OperatonExecution = mock()
        whenever(rootExecution.businessKey).thenReturn(DOCUMENT_ID.toString())
        val subprocessExecution: OperatonExecution = mock()
        whenever(subprocessExecution.businessKey).thenReturn(null)
        whenever(subprocessExecution.superExecution).thenReturn(rootExecution)

        task = mock()
        whenever(task.id).thenReturn(TASK_ID)
        whenever(task.getProcessInstanceId()).thenReturn(PROCESS_INSTANCE_ID)
        whenever(task.processInstance).thenReturn(subprocessExecution)

        val processInstance: ProcessInstance = mock()
        whenever(processInstance.businessKey).thenReturn(DOCUMENT_ID.toString())
        val query: ProcessInstanceQuery = mock()
        whenever(runtimeService.createProcessInstanceQuery()).thenReturn(query)
        whenever(query.processInstanceId(PROCESS_INSTANCE_ID)).thenReturn(query)
        whenever(query.singleResult()).thenReturn(processInstance)

        formFlowDefinition = mock()
        val instance: FormFlowInstance = mock()
        whenever(instance.id).thenReturn(FormFlowInstanceId.newId())
        whenever(formFlowDefinition.createInstance(any())).thenReturn(instance)
        whenever(formFlowService.save(any<FormFlowInstance>())).thenReturn(instance)
    }

    @Test
    fun `should resolve definition by the building block in the process definition version tag`() {
        whenever(processDefinition.getBlueprintId()).thenReturn(BUILDING_BLOCK_DEFINITION_ID)
        whenever(formFlowService.findDefinitionOrNull(FORM_FLOW_KEY, BUILDING_BLOCK_DEFINITION_ID as BlueprintId))
            .thenReturn(formFlowDefinition)

        handler.openTask(task, processLink())

        verify(formFlowService).findDefinitionOrNull(FORM_FLOW_KEY, BUILDING_BLOCK_DEFINITION_ID as BlueprintId)
        verify(documentService, never()).findBy(any())
        verify(processDefinitionCaseDefinitionService, never()).findByProcessDefinitionIdOrNull(any())
    }

    @Test
    fun `should resolve definition by the case document when the process definition has no version tag`() {
        // A process instance started before the 12 -> 13 upgrade: no version tag, no link row.
        whenever(processDefinition.getBlueprintId()).thenReturn(null)
        val document = document(CASE_DEFINITION_ID)
        whenever(documentService.findBy(JsonSchemaDocumentId.existingId(DOCUMENT_ID)))
            .thenReturn(Optional.of(document))
        whenever(formFlowService.findDefinitionOrNull(FORM_FLOW_KEY, CASE_DEFINITION_ID as BlueprintId))
            .thenReturn(formFlowDefinition)

        val result = handler.openTask(task, processLink())

        assertEquals(FORM_FLOW_TASK_TYPE, result.type)
        verify(formFlowService).findDefinitionOrNull(FORM_FLOW_KEY, CASE_DEFINITION_ID as BlueprintId)
        verify(processDefinitionCaseDefinitionService, never()).findByProcessDefinitionIdOrNull(any())
    }

    @Test
    fun `should fall back to the process definition case definition link row`() {
        whenever(processDefinition.getBlueprintId()).thenReturn(null)
        whenever(documentService.findBy(any())).thenReturn(Optional.empty())
        whenever(processDefinitionCaseDefinitionService.findByProcessDefinitionIdOrNull(processDefinitionId()))
            .thenReturn(processDefinitionCaseDefinition(CASE_DEFINITION_ID))
        whenever(formFlowService.findDefinitionOrNull(FORM_FLOW_KEY, CASE_DEFINITION_ID as BlueprintId))
            .thenReturn(formFlowDefinition)

        handler.openTask(task, processLink())

        verify(formFlowService).findDefinitionOrNull(FORM_FLOW_KEY, CASE_DEFINITION_ID as BlueprintId)
    }

    @Test
    fun `should not fall back to a key-only lookup when no blueprint can be resolved`() {
        whenever(processDefinition.getBlueprintId()).thenReturn(null)
        whenever(documentService.findBy(any())).thenReturn(Optional.empty())
        whenever(processDefinitionCaseDefinitionService.findByProcessDefinitionIdOrNull(processDefinitionId()))
            .thenReturn(null)

        val exception = assertThrows<IllegalStateException> { handler.openTask(task, processLink()) }

        assertEquals(
            "FormFlow definition '$FORM_FLOW_KEY' not found for process definition " +
                "'$PROCESS_DEFINITION_ID' and blueprint 'unknown'",
            exception.message
        )
        verify(formFlowService, never()).findDefinitionByKey(any())
    }

    private fun processDefinitionId() = ProcessDefinitionId(PROCESS_DEFINITION_ID)

    private fun processDefinitionCaseDefinition(caseDefinitionId: CaseDefinitionId) =
        ProcessDefinitionCaseDefinition(
            ProcessDefinitionCaseDefinitionId(processDefinitionId(), caseDefinitionId)
        )

    private fun document(caseDefinitionId: CaseDefinitionId): JsonSchemaDocument {
        val document: JsonSchemaDocument = mock()
        whenever(document.definitionId())
            .thenReturn(JsonSchemaDocumentDefinitionId.existingId("aanvraag", caseDefinitionId))
        return document
    }

    private fun processLink() = FormFlowProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = PROCESS_DEFINITION_ID,
        activityId = "do-something",
        activityType = ActivityTypeWithEventName.USER_TASK_START,
        formFlowDefinitionKey = FORM_FLOW_KEY,
        formDisplayType = FormDisplayType.modal,
        formSize = FormSizes.medium,
        subtitles = emptyList(),
    )

    companion object {
        private const val PROCESS_DEFINITION_ID = "some-process:1:af7dbcbe-1b3d-11f0-9d5e-0242ac120002"
        private val PROCESS_INSTANCE_ID = UUID.randomUUID().toString()
        private val DOCUMENT_ID = UUID.randomUUID()
        private val TASK_ID = UUID.randomUUID().toString()
        private const val FORM_FLOW_KEY = "bs-224-vaststelling-inkomen-1"
        private const val FORM_FLOW_TASK_TYPE = "form-flow"
        private val CASE_DEFINITION_ID = CaseDefinitionId("aanvraag-algemene-bijstand-dcm", "0.1.0-migrated")
        private val BUILDING_BLOCK_DEFINITION_ID =
            BuildingBlockDefinitionId("bs-224-vaststelling-inkomen", "1.0.0")
    }
}
