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

package com.ritense.valtimo.golden

import com.ritense.outbox.repository.OutboxMessageRepository
import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valtimo.test.golden.GoldenJson
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.TaskService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.transaction.annotation.Transactional

@Transactional
class TaskCompletedEventGoldenIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var repositoryService: RepositoryService

    @Autowired
    lateinit var taskService: TaskService

    @Autowired
    lateinit var valtimoTaskService: OperatonTaskService

    @Autowired
    lateinit var outboxMessageRepository: OutboxMessageRepository

    @BeforeEach
    fun deployProcess() {
        if (repositoryService.createProcessDefinitionQuery().processDefinitionKey(PROCESS_KEY).count() == 0L) {
            repositoryService.createDeployment()
                .addString("$PROCESS_KEY.bpmn", PROCESS)
                .deploy()
        }
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [ADMIN])
    fun `the task completed event keeps its JSON when the last task completes`() {
        val taskId = startProcess(mapOf("startedWith" to "value"))

        valtimoTaskService.complete(taskId)

        golden("task-completed", taskId)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [ADMIN])
    fun `the task completed event keeps its JSON when the last task completes with form data`() {
        val taskId = startProcess(mapOf("startedWith" to "value"))

        valtimoTaskService.completeTaskWithFormData(taskId, mapOf("submitted" to "form value"))

        golden("task-completed-with-form-data", taskId)
    }

    private fun startProcess(variables: Map<String, Any>): String {
        val processInstance = runtimeService.startProcessInstanceByKey(PROCESS_KEY, "golden-business-key", variables)
        return checkNotNull(
            taskService.createTaskQuery().processInstanceId(processInstance.id).singleResult()
        ).id
    }

    private fun golden(name: String, taskId: String) {
        val message = outboxMessageRepository.findAll()
            .map { it.message }
            .single { it.contains("\"com.ritense.valtimo.task.completed\"") && it.contains(taskId) }
        GoldenJson.assertMatchesGolden(
            javaClass,
            name,
            message,
            unorderedPaths = listOf("/data/result/*", "/data/result/execution/*", "/data/result/execution/variableInstances/*/*")
        )
    }

    companion object {
        private const val PROCESS_KEY = "golden-task-completed-process"
        private val PROCESS = """
            <?xml version="1.0" encoding="UTF-8"?>
            <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="golden" targetNamespace="http://bpmn.io/schema/bpmn">
              <bpmn:process id="$PROCESS_KEY" name="Golden task completed process" isExecutable="true">
                <bpmn:startEvent id="start" />
                <bpmn:sequenceFlow id="to-task" sourceRef="start" targetRef="golden-task" />
                <bpmn:userTask id="golden-task" name="Golden task">
                  <bpmn:extensionElements>
                    <camunda:taskListener event="complete" expression="${'$'}{task.setVariable('setOnComplete', 'yes')}" />
                  </bpmn:extensionElements>
                </bpmn:userTask>
                <bpmn:sequenceFlow id="to-end" sourceRef="golden-task" targetRef="end" />
                <bpmn:endEvent id="end" />
              </bpmn:process>
            </bpmn:definitions>
        """.trimIndent()
    }
}
