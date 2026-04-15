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

package com.ritense.valtimo.operaton.repository

import com.ritense.valtimo.BaseIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.operaton.bpm.engine.TaskService
import org.operaton.bpm.engine.impl.persistence.entity.SuspensionState
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.util.UUID

class OperatonTaskSpecificationHelperIntTest @Autowired constructor(
    private val taskService: TaskService,
    private val operatonTaskRepository: OperatonTaskRepository
): BaseIntegrationTest() {

    lateinit var oneTaskInstances: List<ProcessInstance>
    lateinit var userTaskInstance: ProcessInstance
    lateinit var createDate: LocalDateTime

    @BeforeEach
    fun prepare() {
        createDate = LocalDateTime.now()
        Thread.sleep(1000)

        oneTaskInstances = (1..3)
            .map {
                runtimeService.startProcessInstanceByKey(
                    "one-task-process",
                    UUID.randomUUID().toString(),
                    mapOf("oneTask" to true)
                )
            }.toList()

        userTaskInstance = runtimeService.startProcessInstanceByKey(
            "user-task-process",
            UUID.randomUUID().toString(),
            mapOf("userTask" to true)
        )
    }


    @Test
    @Transactional
    fun byId() {
        val taskId = getRandomOneTaskProcessTask().id

        val operatonTask = operatonTaskRepository.findOne(OperatonTaskSpecificationHelper.byId(taskId)).get()

        assertThat(operatonTask.id).isEqualTo(taskId)
    }

    @Test
    @Transactional
    fun byProcessInstanceId() {
        val processInstanceId = getRandomOneTaskProcessInstance().id
        val operatonTask = operatonTaskRepository.findOne(OperatonTaskSpecificationHelper.byProcessInstanceId(processInstanceId)).get()

        assertThat(operatonTask.getProcessInstanceId()).isEqualTo(processInstanceId)
    }

    @Test
    @Transactional
    fun byProcessInstanceBusinessKey() {
        val processInstance = getRandomOneTaskProcessInstance()
        val operatonTask = operatonTaskRepository.findOne(OperatonTaskSpecificationHelper.byProcessInstanceBusinessKey(processInstance.businessKey)).get()

        assertThat(operatonTask.getProcessInstanceId()).isEqualTo(processInstance.id)
    }

    @Test
    @Transactional
    fun byRootProcessInstanceBusinessKey() {
        val processInstance = getRandomOneTaskProcessInstance()
        val operatonTask = operatonTaskRepository.findOne(
            OperatonTaskSpecificationHelper.byRootProcessInstanceBusinessKey(processInstance.businessKey)
        ).get()

        assertThat(operatonTask.getProcessInstanceId()).isEqualTo(processInstance.id)
    }

    @Test
    @Transactional
    fun `byRootProcessInstanceBusinessKey should not match non-existing business key`() {
        val tasks = operatonTaskRepository.findAll(
            OperatonTaskSpecificationHelper.byRootProcessInstanceBusinessKey(UUID.randomUUID().toString())
        )

        assertThat(tasks).isEmpty()
    }

    @Test
    @Transactional
    fun byRootProcessInstanceBusinessKeys() {
        val businessKeys = oneTaskInstances.map { it.businessKey }
        val operatonTasks = operatonTaskRepository.findAll(
            OperatonTaskSpecificationHelper.byRootProcessInstanceBusinessKeys(businessKeys)
        )

        assertThat(operatonTasks).hasSize(oneTaskInstances.size)
        assertThat(operatonTasks.map { it.getProcessInstanceId() })
            .containsExactlyInAnyOrderElementsOf(oneTaskInstances.map { it.id })
    }

    @Test
    @Transactional
    fun `byRootProcessInstanceBusinessKeys should return empty for empty collection`() {
        val tasks = operatonTaskRepository.findAll(
            OperatonTaskSpecificationHelper.byRootProcessInstanceBusinessKeys(emptyList())
        )

        assertThat(tasks).isEmpty()
    }

    @Test
    @Transactional
    fun byProcessDefinitionKeys() {
        val allProcessInstanceIds = (oneTaskInstances + userTaskInstance).map { it.processInstanceId }

        val operatonTasksProcessInstanceIds = operatonTaskRepository.findAll(OperatonTaskSpecificationHelper.byProcessDefinitionKeys(setOf("one-task-process", "user-task-process")))
            .map { it.getProcessInstanceId() }

        assertThat(operatonTasksProcessInstanceIds).containsAll(allProcessInstanceIds)
    }

    @Test
    @Transactional
    fun byProcessDefinitionId() {
        val allOneTaskIds = taskService.createTaskQuery()
            .taskDefinitionKey("one-task-process")
            .list()
            .map { it.id }

        val operatonTasksIds = operatonTaskRepository.findAll(OperatonTaskSpecificationHelper.byProcessDefinitionId(getRandomOneTaskProcessInstance().processDefinitionId))
            .map { it.id }

        assertThat(operatonTasksIds).containsAll(allOneTaskIds)
    }

    @Test
    @Transactional
    fun byCandidateGroups() {
        val allTaskIds = getAllTaskIds()

        val operatonTasksIds = operatonTaskRepository.findAll(OperatonTaskSpecificationHelper.byCandidateGroups("ROLE_USER", "ROLE_ADMIN"))
            .map { it.id }

        assertThat(operatonTasksIds).containsAll(allTaskIds)
    }

    @Test
    @Transactional
    fun byName() {
        val allOneTaskIds = taskService.createTaskQuery()
            .taskDefinitionKey("one-task-process")
            .list()
            .map { it.id }

        val operatonTasksIds = operatonTaskRepository.findAll(OperatonTaskSpecificationHelper.byName("Do something"))
            .map { it.id }

        assertThat(operatonTasksIds).containsAll(allOneTaskIds)
    }

    @Test
    @Transactional
    fun byAssignee() {
        val randomUserId = UUID.randomUUID().toString()
        val randomTask = getRandomOneTaskProcessTask()

        taskService.setAssignee(randomTask.id, randomUserId)

        val operatonTask = operatonTaskRepository.findOne(OperatonTaskSpecificationHelper.byAssignee(randomUserId)).get()

        assertThat(operatonTask.id).isEqualTo(randomTask.id)
    }

    @Test
    @Transactional
    fun byUnassigned() {
        val randomTask = getRandomOneTaskProcessTask()

        taskService.setAssignee(randomTask.id, UUID.randomUUID().toString())

        val operatonTaskIds = operatonTaskRepository.findAll(OperatonTaskSpecificationHelper.byUnassigned())
            .map { it.id }

        val allTaskIds = getAllTaskIds()

        assertThat(operatonTaskIds).hasSize(allTaskIds.size - 1)
        assertThat(operatonTaskIds).doesNotContain(randomTask.id)
    }

    @Test
    @Transactional
    fun byAssigned() {
        val randomTask = getRandomOneTaskProcessTask()

        taskService.setAssignee(randomTask.id, UUID.randomUUID().toString())

        val operatonTask = operatonTaskRepository.findOne(OperatonTaskSpecificationHelper.byAssigned()).get()

        assertThat(operatonTask.id).isEqualTo(randomTask.id)
    }

    @Test
    @Transactional
    fun byCreateTimeAfter() {
        val operatonTaskIds = operatonTaskRepository.findAll(OperatonTaskSpecificationHelper.byCreateTimeAfter(createDate))
            .map { it.id }

        val allTaskIds = getAllTaskIds()

        assertThat(operatonTaskIds).containsAll(allTaskIds)
    }

    @Test
    @Transactional
    fun byCreateTimeBefore() {
        Thread.sleep(1000)
        val operatonTaskIds = operatonTaskRepository.findAll(OperatonTaskSpecificationHelper.byCreateTimeBefore(LocalDateTime.now()))
            .map { it.id }

        val allTaskIds = getAllTaskIds()

        assertThat(operatonTaskIds).containsAll(allTaskIds)
    }

    @Test
    @Transactional
    fun bySuspensionState() {
        val task = getRandomOneTaskProcessTask()
        taskService.complete(task.id)

        val operatonTaskIds = operatonTaskRepository.findAll(
            OperatonTaskSpecificationHelper.bySuspensionState(
                SuspensionState.ACTIVE.stateCode)
            )
            .map { it.id }

        assertThat(operatonTaskIds).isNotEmpty
        assertThat(operatonTaskIds).doesNotContain(task.id)
    }

    @Test
    @Disabled
    @Transactional
    fun byActive() {
        val task = getRandomOneTaskProcessTask()
        taskService.complete(task.id)

        val operatonTaskIds = operatonTaskRepository.findAll(
            OperatonTaskSpecificationHelper.byActive())
            .map { it.id }

        assertThat(operatonTaskIds).isNotEmpty
        assertThat(operatonTaskIds).doesNotContain(task.id)
    }

    private fun getAllTaskIds(): List<String> {
        return taskService.createTaskQuery()
            .list()
            .map { it.id }
    }

    private fun getRandomOneTaskProcessInstance() = oneTaskInstances.random()

    private fun getRandomOneTaskProcessTask() = taskService.createTaskQuery()
        .processInstanceId(getRandomOneTaskProcessInstance().id)
        .singleResult()
}