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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.processlink.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.formflow.FormFlowTaskOpenResultProperties
import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.domain.definition.FormFlowDefinitionId
import com.ritense.formflow.domain.definition.FormFlowStep
import com.ritense.formflow.domain.definition.FormFlowStepId
import com.ritense.formflow.domain.definition.configuration.FormFlowStepType
import com.ritense.formflow.domain.definition.configuration.step.FormStepTypeProperties
import com.ritense.formflow.domain.instance.FormFlowInstanceId
import com.ritense.formflow.repository.FormFlowDefinitionRepository
import com.ritense.formflow.service.FormFlowService
import com.ritense.formflow.web.rest.FormFlowResource
import com.ritense.formflow.web.rest.dto.FormFlowProcessLinkCreateRequestDto
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.processlink.service.ProcessLinkActivityService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byProcessInstanceId
import com.ritense.valtimo.service.OperatonTaskService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * Integration test verifying that a building block sub-process with a form-flow-protected user task
 * correctly writes the form submission to the building block's document.
 *
 * Flow:
 *  1. A case is created and the main process starts.
 *  2. The main process calls the building block sub-process (building-block-form-flow-process).
 *  3. The sub-process has a user task linked to a building-block-owned form flow.
 *  4. Completing the form flow step calls valtimoFormFlow.completeTask, which resolves
 *     additionalProperties["documentId"] from the sub-process business key (= BB document ID)
 *     and writes the submission to the BB document.
 */
@Transactional
class BuildingBlockFormFlowIT @Autowired constructor(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val documentService: DocumentService,
    private val processDocumentService: ProcessDocumentService,
    private val formFlowDefinitionRepository: FormFlowDefinitionRepository,
    private val processLinkActivityService: ProcessLinkActivityService,
    private val processLinkRepository: ProcessLinkRepository,
    private val formFlowResource: FormFlowResource,
    private val operatonTaskService: OperatonTaskService,
    private val formFlowService: FormFlowService,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @Test
    fun `completing building block form flow writes submission to building block document`() {
        val bbId = BuildingBlockDefinitionId(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
        val formFlowDefinitionId = FormFlowDefinitionId.existingId(FORM_FLOW_KEY, bbId)

        // Save the form flow definition directly via repository — bypasses the "final building block"
        // write check that would block formFlowDefinitionImporter.deploy() for bezwaar
        val step = FormFlowStep(
            id = FormFlowStepId(FORM_FLOW_STEP_KEY),
            onComplete = listOf("\${valtimoFormFlow.completeTask(additionalProperties, step.submissionData)}"),
            type = FormFlowStepType("form", FormStepTypeProperties("bb-form"))
        )
        formFlowDefinitionRepository.save(
            FormFlowDefinition(formFlowDefinitionId, FORM_FLOW_STEP_KEY, setOf(step))
        )

        // Link the form flow to the user task in the building block sub-process.
        // The process link must reference the sub-process definition (which contains the user task).
        val subProcessDefinitionId = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(SUB_PROCESS_KEY)
            .latestVersion()
            .singleResult()
            ?.id ?: error("Process definition '$SUB_PROCESS_KEY' not deployed")

        processLinkService.createProcessLink(
            FormFlowProcessLinkCreateRequestDto(
                subProcessDefinitionId,
                USER_TASK_ID,
                ActivityTypeWithEventName.USER_TASK_CREATE,
                FORM_FLOW_KEY
            ),
            bbId
        )

        // Register the building block process link on the call activity in the main process.
        // Without this, BuildingBlockCallActivityListener won't create the BB document or set
        // the buildingBlockDocumentId variable that the call activity's businessKey expression depends on.
        val mainProcessDefinitionId = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(MAIN_PROCESS_KEY)
            .latestVersion()
            .singleResult()
            ?.id ?: error("Process definition '$MAIN_PROCESS_KEY' not deployed")

        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = mainProcessDefinitionId,
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = bbId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList()
            )
        )

        // Create a case document and start the main process — this triggers the call activity
        // which starts the building block sub-process with its user task
        val caseDocumentAndProcess = runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(
                NewDocumentAndStartProcessRequest(
                    MAIN_PROCESS_KEY,
                    NewDocumentRequest(
                        CASE_DOCUMENT_DEFINITION_NAME,
                        CASE_DEFINITION_KEY,
                        CASE_DEFINITION_VERSION,
                        objectMapper.createObjectNode()
                    )
                )
            )
        }
        assertThat(caseDocumentAndProcess.resultingDocument()).isPresent

        // The call activity has started the building block sub-process;
        // retrieve the BB instance to find the BB document ID (= sub-process business key)
        val bbInstances = buildingBlockInstanceRepository.findAll()
        assertThat(bbInstances).hasSize(1)
        val bbDocumentId = bbInstances.first().documentId.toString()

        // Locate the running sub-process instance by its business key
        val subProcessInstance = runtimeService.createProcessInstanceQuery()
            .processInstanceBusinessKey(bbDocumentId)
            .processDefinitionKey(SUB_PROCESS_KEY)
            .singleResult() ?: error("Sub-process '$SUB_PROCESS_KEY' not found for business key $bbDocumentId")

        // Find the user task in the sub-process
        val tasks = runWithoutAuthorization {
            operatonTaskService.findTasks(byProcessInstanceId(subProcessInstance.id))
        }
        assertThat(tasks).hasSize(1)

        // Open the task — creates the form flow instance and returns its properties
        val taskOpenResult = runWithoutAuthorization {
            processLinkActivityService.openTask(UUID.fromString(tasks.first().id))
        }
        assertThat(taskOpenResult.properties).isInstanceOf(FormFlowTaskOpenResultProperties::class.java)
        val formFlowInstanceId = (taskOpenResult.properties as FormFlowTaskOpenResultProperties).formFlowInstanceId
        val formFlowInstance = formFlowService.getInstanceById(FormFlowInstanceId.existingId(formFlowInstanceId))

        // Complete the form flow step with submission data
        runWithoutAuthorization {
            formFlowResource.completeStep(
                formFlowInstance.id.id.toString(),
                formFlowInstance.currentFormFlowStepInstanceId!!.id.toString(),
                objectMapper.readTree("""{"straatnaam":"Hoofdstraat"}""")
            )
        }

        // After completion, the BB document should contain the submitted data under "submission"
        val bbDocument = runWithoutAuthorization {
            documentService.get(bbDocumentId)
        } as JsonSchemaDocument
        val content = bbDocument.content().asJson()
        assertThat(content.has("submission")).isTrue()
        assertThat(content.get("submission").get("straatnaam").asText()).isEqualTo("Hoofdstraat")
    }

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val CASE_DOCUMENT_DEFINITION_NAME = "bb-case"
        private const val MAIN_PROCESS_KEY = "building-block-form-flow-main"
        private const val SUB_PROCESS_KEY = "building-block-form-flow-process"
        private const val CALL_ACTIVITY_ID = "callActivity"
        private const val USER_TASK_ID = "form-flow-task"
        private const val FORM_FLOW_KEY = "bb-test-form-flow"
        private const val FORM_FLOW_STEP_KEY = "step1"
    }
}
