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
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.form.domain.FormDefinitionBlueprintId
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.form.service.PrefillFormService
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.TaskService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class BuildingBlockFormPrefillIT @Autowired constructor(
    private val processLinkRepository: ProcessLinkRepository,
    private val formDefinitionRepository: FormDefinitionRepository,
    private val prefillFormService: PrefillFormService,
    private val processDocumentService: ProcessDocumentService,
    private val repositoryService: RepositoryService,
    private val taskService: TaskService,
    private val objectMapper: ObjectMapper,
) : BaseIntegrationTest() {

    @Test
    fun `should prefill doc referenced form fields from the building block document on a bb user task`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION)

        // A building block form with a doc: source key, as saved by the form builder
        val formDefinition = formDefinitionRepository.save(
            FormIoFormDefinition(
                UUID.randomUUID(),
                "bb-prefill-form",
                """
                    {
                        "display": "form",
                        "components": [
                            {
                                "label": "Straatnaam",
                                "key": "straatnaam",
                                "type": "textfield",
                                "input": true,
                                "properties": {
                                    "sourceKey": "doc:/straatnaam"
                                }
                            }
                        ]
                    }
                """.trimIndent(),
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
                inputMappings = listOf(
                    BuildingBlockInputMapping(
                        source = "doc:/contact/firstName",
                        target = "straatnaam"
                    )
                )
            )
        )

        val caseContent = objectMapper.createObjectNode().apply {
            putObject("contact").put("firstName", "Kalverstraat 1")
        }
        runWithoutAuthorization {
            processDocumentService.newDocumentAndStartProcess(
                NewDocumentAndStartProcessRequest(
                    MAIN_PROCESS_KEY,
                    NewDocumentRequest(
                        CASE_DOCUMENT_DEFINITION_NAME,
                        CASE_DEFINITION_KEY,
                        CASE_DEFINITION_VERSION,
                        caseContent
                    )
                )
            )
        }

        val task = taskService.createTaskQuery()
            .taskDefinitionKey(USER_TASK_ID)
            .singleResult()
        assertThat(task).isNotNull

        // Prefill the form the same way FormProcessLinkActivityHandler.openTask does
        val prefilledForm = runWithoutAuthorization {
            prefillFormService.getPrefilledFormDefinition(
                formDefinition.id,
                task.processInstanceId,
                task.id
            )
        }

        val straatnaamComponent = prefilledForm.asJson()
            .get("components")
            .single { it.get("key").asText() == "straatnaam" }
        assertThat(straatnaamComponent.get("defaultValue").asText()).isEqualTo("Kalverstraat 1")
    }

    private fun processDefinitionId(processKey: String): String {
        val definition = repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(processKey)
            .latestVersion()
            .singleResult()
            ?: throw IllegalStateException("Process definition '$processKey' not deployed")
        return definition.id
    }

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
