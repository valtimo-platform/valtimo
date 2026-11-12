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
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.form.domain.FormDefinitionBlueprintId
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.domain.FormProcessLink
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.form.service.FormSubmissionService
import com.ritense.form.web.rest.dto.FormSubmissionResultFailed
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.TaskService
import org.operaton.bpm.engine.task.Task
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class BuildingBlockTaskFormSubmissionIT @Autowired constructor(
    private val processLinkRepository: ProcessLinkRepository,
    private val formDefinitionRepository: FormDefinitionRepository,
    private val formSubmissionService: FormSubmissionService,
    private val processDocumentService: ProcessDocumentService,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
    private val taskService: TaskService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @Test
    fun `building block task form submitted with the building block document completes the task`() {
        val scenario = startCaseWithBuildingBlockTask()
        val buildingBlockDocumentId = businessKeyOf(scenario.task)
        assertThat(buildingBlockDocumentId).isNotEqualTo(scenario.caseDocumentId)

        val result = runWithoutAuthorization {
            formSubmissionService.handleSubmission(
                scenario.formProcessLinkId,
                objectMapper.readTree("""{"straatnaam":"Kalverstraat 1"}"""),
                null,
                buildingBlockDocumentId,
                scenario.task.id
            )
        }

        assertThat(result.errors()).isEmpty()
        assertThat(taskService.createTaskQuery().taskId(scenario.task.id).count()).isZero()
    }

    @Test
    fun `building block task form submitted with the case document is rejected and the task stays open`() {
        val scenario = startCaseWithBuildingBlockTask()

        val result = runWithoutAuthorization {
            formSubmissionService.handleSubmission(
                scenario.formProcessLinkId,
                objectMapper.readTree("""{"straatnaam":"Kalverstraat 1"}"""),
                null,
                scenario.caseDocumentId,
                scenario.task.id
            )
        }

        assertThat(result).isInstanceOf(FormSubmissionResultFailed::class.java)
        assertThat(taskService.createTaskQuery().taskId(scenario.task.id).count()).isOne()
    }

    private fun startCaseWithBuildingBlockTask(): Scenario {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)
        val formDefinition = formDefinitionRepository.save(
            FormIoFormDefinition(
                UUID.randomUUID(),
                "bb-task-form",
                """{"display":"form","components":[{"key":"straatnaam","type":"textfield","input":true}]}""",
                FormDefinitionBlueprintId.forBuildingBlock(buildingBlockDefinitionId),
                false
            )
        )
        processLinkRepository.save(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId(MAIN_PROCESS_KEY),
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = buildingBlockDefinitionId,
                pluginConfigurationMappings = emptyMap(),
                inputMappings = emptyList()
            )
        )

        val caseDocument = runWithoutAuthorization {
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
        }.resultingDocument().orElseThrow()

        val task = taskService.createTaskQuery().taskDefinitionKey(USER_TASK_ID).singleResult()
        val formProcessLink = processLinkRepository.save(
            FormProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = task.processDefinitionId,
                activityId = USER_TASK_ID,
                activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
                formDefinitionId = requireNotNull(formDefinition.id)
            )
        )
        return Scenario(caseDocument.id().toString(), task, formProcessLink.id)
    }

    private fun businessKeyOf(task: Task): String {
        return runtimeService.createProcessInstanceQuery()
            .processInstanceId(task.processInstanceId)
            .singleResult()
            .businessKey
    }

    private fun processDefinitionId(processKey: String): String {
        return repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(processKey)
            .latestVersion()
            .singleResult()
            ?.id
            ?: throw IllegalStateException("Process definition '$processKey' not deployed")
    }

    private data class Scenario(
        val caseDocumentId: String,
        val task: Task,
        val formProcessLinkId: UUID,
    )

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val CASE_DOCUMENT_DEFINITION_NAME = "bb-case"
        private const val MAIN_PROCESS_KEY = "bb-call-activity-main-with-user-task"
        private const val CALL_ACTIVITY_ID = "callActivity"
        private const val USER_TASK_ID = "bbUserTask"
    }
}
