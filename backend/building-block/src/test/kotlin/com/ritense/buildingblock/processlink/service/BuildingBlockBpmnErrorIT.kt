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
import com.ritense.buildingblock.TestBpmnErrorPlugin
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.TaskService
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.builder.AbstractFlowNodeBuilder
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

/**
 * Not @Transactional: the bug only shows when the process transaction actually commits.
 */
class BuildingBlockBpmnErrorIT @Autowired constructor(
    private val documentService: DocumentService,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val processLinkRepository: ProcessLinkRepository,
    private val objectMapper: ObjectMapper,
    private val repositoryService: RepositoryService,
    private val runtimeService: RuntimeService,
    private val taskService: TaskService,
    private val transactionTemplate: TransactionTemplate,
) : BaseIntegrationTest() {

    private val deploymentIds = mutableListOf<String>()
    private val processLinkIds = mutableListOf<UUID>()
    private val caseDocumentIds = mutableListOf<UUID>()

    @AfterEach
    fun cleanUp() {
        transactionTemplate.executeWithoutResult {
            processLinkIds.forEach(processLinkRepository::deleteById)
            // Committed instances break other ITs asserting on findAll(); children before parents
            val (children, parents) = caseDocumentIds
                .flatMap(buildingBlockInstanceRepository::findAllByCaseDocumentId)
                .partition { it.parentBuildingBlockInstanceId != null }
            buildingBlockInstanceRepository.deleteAllInBatch(children)
            buildingBlockInstanceRepository.deleteAllInBatch(parents)
        }
        deploymentIds.forEach { repositoryService.deleteDeployment(it, true) }
    }

    @Test
    fun `boundary error event on a building block call activity catches a BpmnError thrown by a plugin`() {
        deploy(
            serviceTaskProcess(BB_PROCESS_KEY, "BB:$BUILDING_BLOCK_KEY:$BUILDING_BLOCK_VERSION"),
            callActivityProcess(BB_PARENT_PROCESS_KEY, BB_PROCESS_KEY, "BB:$BUILDING_BLOCK_KEY:$BUILDING_BLOCK_VERSION")
        )
        saveProcessLinks(
            BuildingBlockProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId(BB_PARENT_PROCESS_KEY),
                activityId = CALL_ACTIVITY_ID,
                activityType = ActivityTypeWithEventName.CALL_ACTIVITY_START,
                buildingBlockDefinitionId = BuildingBlockDefinitionId.of(BUILDING_BLOCK_KEY, BUILDING_BLOCK_VERSION),
                pluginConfigurationMappings = mapOf(TestBpmnErrorPlugin.PLUGIN_KEY to PLUGIN_CONFIGURATION_ID),
            ),
            pluginProcessLink(
                processDefinitionId(BB_PROCESS_KEY),
                PluginConfigurationReference(PluginConfigurationReferenceType.BUILDING_BLOCK, TestBpmnErrorPlugin.PLUGIN_KEY)
            )
        )

        val processInstanceId = startProcess(BB_PARENT_PROCESS_KEY)

        assertErrorPathTaken(processInstanceId)
    }

    @Test
    fun `boundary error event on a plain call activity catches a BpmnError thrown by a plugin`() {
        deploy(
            serviceTaskProcess(PLAIN_PROCESS_KEY),
            callActivityProcess(PLAIN_PARENT_PROCESS_KEY, PLAIN_PROCESS_KEY, null)
        )
        saveProcessLinks(pluginProcessLink(processDefinitionId(PLAIN_PROCESS_KEY)))

        val processInstanceId = startProcess(PLAIN_PARENT_PROCESS_KEY)

        assertErrorPathTaken(processInstanceId)
    }

    @Test
    fun `boundary error event on a service task catches a BpmnError thrown by its plugin`() {
        deploy(serviceTaskProcess(SERVICE_TASK_PROCESS_KEY, withBoundaryEvent = true))
        saveProcessLinks(pluginProcessLink(processDefinitionId(SERVICE_TASK_PROCESS_KEY)))

        val processInstanceId = startProcess(SERVICE_TASK_PROCESS_KEY)

        assertErrorPathTaken(processInstanceId)
    }

    @Test
    fun `boundary error event on a user task catches a BpmnError thrown by its create plugin`() {
        deploy(userTaskProcess(USER_TASK_PROCESS_KEY))
        saveProcessLinks(
            pluginProcessLink(
                processDefinitionId(USER_TASK_PROCESS_KEY),
                activityId = USER_TASK_ID,
                activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            )
        )

        val processInstanceId = startProcess(USER_TASK_PROCESS_KEY)

        assertErrorPathTaken(processInstanceId)
    }

    @Test
    fun `a technical failure thrown by a plugin still rolls back`() {
        deploy(serviceTaskProcess(SERVICE_TASK_PROCESS_KEY, withBoundaryEvent = true))
        saveProcessLinks(
            pluginProcessLink(processDefinitionId(SERVICE_TASK_PROCESS_KEY), action = TestBpmnErrorPlugin.THROW_RUNTIME_EXCEPTION)
        )

        assertThatThrownBy { startProcess(SERVICE_TASK_PROCESS_KEY) }
            .hasRootCauseInstanceOf(IllegalStateException::class.java)
            .hasRootCauseMessage("Technical failure")
        assertThat(runtimeService.createProcessInstanceQuery().processDefinitionKey(SERVICE_TASK_PROCESS_KEY).count())
            .isZero()
    }

    private fun startProcess(processKey: String): String {
        return transactionTemplate.execute {
            val caseDocumentId = runWithoutAuthorization {
                documentService.createDocument(
                    NewDocumentRequest(
                        CASE_DEFINITION_KEY,
                        CASE_DEFINITION_KEY,
                        CASE_DEFINITION_VERSION,
                        objectMapper.createObjectNode()
                    )
                ).resultingDocument().orElseThrow().id().getId()
            }
            caseDocumentIds += caseDocumentId
            runtimeService.startProcessInstanceByKey(processKey, caseDocumentId.toString()).id
        }!!
    }

    private fun assertErrorPathTaken(processInstanceId: String) {
        val taskKeys = taskService.createTaskQuery()
            .processInstanceId(processInstanceId)
            .list()
            .map { it.taskDefinitionKey }
        assertThat(taskKeys).containsExactly(ERROR_HANDLED_TASK_ID)
    }

    private fun saveProcessLinks(vararg processLinks: ProcessLink) {
        transactionTemplate.executeWithoutResult {
            processLinks.forEach { processLinkIds += processLinkRepository.save(it).id }
        }
    }

    private fun pluginProcessLink(
        processDefinitionId: String,
        reference: PluginConfigurationReference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED),
        activityId: String = SERVICE_TASK_ID,
        activityType: ActivityTypeWithEventName = ActivityTypeWithEventName.SERVICE_TASK_START,
        action: String = TestBpmnErrorPlugin.THROW_BPMN_ERROR,
    ) = PluginProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = activityType,
        actionProperties = objectMapper.createObjectNode(),
        pluginConfigurationId = PluginConfigurationId.existingId(PLUGIN_CONFIGURATION_ID)
            .takeIf { reference.type == PluginConfigurationReferenceType.FIXED },
        pluginConfigurationReference = reference,
        pluginActionDefinitionKey = action
    )

    private fun deploy(vararg models: Pair<String, BpmnModelInstance>) {
        val deployment = repositoryService.createDeployment()
        models.forEach { (key, model) -> deployment.addModelInstance("$key.bpmn", model) }
        deploymentIds += deployment.deploy().id
    }

    private fun processDefinitionId(processKey: String): String =
        repositoryService.createProcessDefinitionQuery()
            .processDefinitionKey(processKey)
            .latestVersion()
            .singleResult()
            .id

    private fun serviceTaskProcess(
        key: String,
        versionTag: String? = null,
        withBoundaryEvent: Boolean = false,
    ): Pair<String, BpmnModelInstance> {
        val process = Bpmn.createExecutableProcess(key)
            .operatonVersionTag(versionTag)
            .startEvent()
            .serviceTask(SERVICE_TASK_ID).operatonExpression("\${null}")
            .userTask(HAPPY_TASK_ID)
            .endEvent()
        val model = if (withBoundaryEvent) process.withErrorBoundaryEvent(SERVICE_TASK_ID) else process.done()
        return key to model
    }

    private fun userTaskProcess(key: String): Pair<String, BpmnModelInstance> {
        val model = Bpmn.createExecutableProcess(key)
            .startEvent()
            .userTask(USER_TASK_ID)
            .endEvent()
            .withErrorBoundaryEvent(USER_TASK_ID)
        return key to model
    }

    private fun callActivityProcess(
        key: String,
        calledKey: String,
        calledVersionTag: String?,
    ): Pair<String, BpmnModelInstance> {
        val callActivity = Bpmn.createExecutableProcess(key)
            .operatonVersionTag("CD:$CASE_DEFINITION_KEY:$CASE_DEFINITION_VERSION")
            .startEvent()
            .callActivity(CALL_ACTIVITY_ID)
            .calledElement(calledKey)
        if (calledVersionTag != null) {
            callActivity.operatonCalledElementBinding("versionTag")
                .operatonCalledElementVersionTag(calledVersionTag)
                .operatonInBusinessKey("#{buildingBlockDocumentId}")
        } else {
            callActivity.operatonInBusinessKey("#{execution.processBusinessKey}")
        }
        val model = callActivity
            .userTask(HAPPY_TASK_ID)
            .endEvent()
            .withErrorBoundaryEvent(CALL_ACTIVITY_ID)
        return key to model
    }

    private fun AbstractFlowNodeBuilder<*, *>.withErrorBoundaryEvent(
        activityId: String
    ): BpmnModelInstance = moveToActivity(activityId)
        .boundaryEvent("errorBoundary").error(TestBpmnErrorPlugin.ERROR_CODE)
        .userTask(ERROR_HANDLED_TASK_ID)
        .endEvent()
        .done()

    companion object {
        private const val BUILDING_BLOCK_KEY = "bezwaar"
        private const val BUILDING_BLOCK_VERSION = "1.0.0"
        private const val CASE_DEFINITION_KEY = "bb-case"
        private const val CASE_DEFINITION_VERSION = "1.0.0"
        private const val BB_PARENT_PROCESS_KEY = "bpmn-error-bb-parent"
        private const val BB_PROCESS_KEY = "bpmn-error-bb-process"
        private const val PLAIN_PARENT_PROCESS_KEY = "bpmn-error-plain-parent"
        private const val PLAIN_PROCESS_KEY = "bpmn-error-plain-process"
        private const val SERVICE_TASK_PROCESS_KEY = "bpmn-error-service-task"
        private const val USER_TASK_PROCESS_KEY = "bpmn-error-user-task"
        private const val CALL_ACTIVITY_ID = "callActivity"
        private const val SERVICE_TASK_ID = "throwingTask"
        private const val USER_TASK_ID = "throwingUserTask"
        private const val HAPPY_TASK_ID = "happyTask"
        private const val ERROR_HANDLED_TASK_ID = "errorHandledTask"
        private val PLUGIN_CONFIGURATION_ID = UUID.fromString("7c2e9d14-5a3b-4f6e-8d21-9b0c4e7f3a52")
    }
}
