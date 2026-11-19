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

package com.ritense.valtimo.operaton.variable

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.operaton.repository.OperatonVariableInstanceRepository
import com.ritense.valtimo.service.OperatonTaskService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.HistoryService
import org.operaton.bpm.engine.TaskService
import org.operaton.bpm.engine.impl.persistence.entity.VariableInstanceEntity
import org.operaton.bpm.engine.variable.Variables
import org.operaton.bpm.engine.variable.type.ValueType
import org.operaton.bpm.engine.variable.value.TypedValue
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class LargeStringValueSerializerIntTest @Autowired constructor(
    private val operatonVariableInstanceRepository: OperatonVariableInstanceRepository,
    private val historyService: HistoryService,
    private val taskService: TaskService,
    private val operatonTaskService: OperatonTaskService,
) : BaseIntegrationTest() {

    @Test
    fun `should store string longer than 4000 characters`() {
        val instance = startProcess(mapOf("text" to LARGE_STRING))

        assertThat(runtimeService.getVariable(instance.id, "text")).isEqualTo(LARGE_STRING)
        assertThat(runtimeService.getVariableTyped<TypedValue>(instance.id, "text").type).isEqualTo(ValueType.STRING)
        assertThat(findVariableInstance(instance.id, "text").serializerName).isEqualTo(LargeStringValueSerializer.NAME)
    }

    @Test
    fun `should read string longer than 4000 characters via operaton variable instance`() {
        val instance = startProcess(mapOf("text" to LARGE_STRING))

        val variableInstance = operatonVariableInstanceRepository.findAll { root, _, criteriaBuilder ->
            criteriaBuilder.and(
                criteriaBuilder.equal(root.get<Any>("processInstance").get<Any>("id"), instance.id),
                criteriaBuilder.equal(root.get<String>("name"), "text")
            )
        }.single()
        assertThat(variableInstance.serializerName).isEqualTo(LargeStringValueSerializer.NAME)
        assertThat(variableInstance.getValue()).isEqualTo(LARGE_STRING)
    }

    @Test
    fun `should store typed string longer than 4000 characters`() {
        val instance = startProcess(mapOf("text" to Variables.stringValue(LARGE_STRING)))

        assertThat(runtimeService.getVariable(instance.id, "text")).isEqualTo(LARGE_STRING)
        assertThat(findVariableInstance(instance.id, "text").serializerName).isEqualTo(LargeStringValueSerializer.NAME)
    }

    @Test
    fun `should keep using default string serializer for string of 4000 characters`() {
        val text = "a".repeat(4000)
        val instance = startProcess(mapOf("text" to text))

        val variableInstance = findVariableInstance(instance.id, "text")
        assertThat(variableInstance.serializerName).isEqualTo(ValueType.STRING.name)
        assertThat(variableInstance.textValue).isEqualTo(text)
        assertThat(variableInstance.byteArrayValueId).isNull()
    }

    @Test
    fun `should switch serializer when updating variable`() {
        val instance = startProcess(mapOf("text" to "short"))

        runtimeService.setVariable(instance.id, "text", LARGE_STRING)
        assertThat(findVariableInstance(instance.id, "text").serializerName).isEqualTo(LargeStringValueSerializer.NAME)
        assertThat(runtimeService.getVariable(instance.id, "text")).isEqualTo(LARGE_STRING)

        runtimeService.setVariable(instance.id, "text", "short again")
        val variableInstance = findVariableInstance(instance.id, "text")
        assertThat(variableInstance.serializerName).isEqualTo(ValueType.STRING.name)
        assertThat(variableInstance.byteArrayValueId).isNull()
        assertThat(runtimeService.getVariable(instance.id, "text")).isEqualTo("short again")
    }

    @Test
    fun `should store large string in history`() {
        val instance = startProcess(mapOf("text" to LARGE_STRING))

        val historicVariable = historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(instance.id)
            .variableName("text")
            .singleResult()
        assertThat(historicVariable.value).isEqualTo(LARGE_STRING)
    }

    @Test
    fun `should store string longer than 4000 characters when completing task with form data`() {
        val instance = startProcess(mapOf())
        val task = taskService.createTaskQuery().processInstanceId(instance.id).singleResult()

        runWithoutAuthorization { operatonTaskService.completeTaskWithFormData(task.id, mapOf("text" to LARGE_STRING)) }

        val historicVariable = historyService.createHistoricVariableInstanceQuery()
            .processInstanceId(instance.id)
            .variableName("text")
            .singleResult()
        assertThat(historicVariable.value).isEqualTo(LARGE_STRING)
    }

    private fun startProcess(variables: Map<String, Any>) = runtimeService.startProcessInstanceByKey(
        "one-task-process",
        UUID.randomUUID().toString(),
        variables
    )

    private fun findVariableInstance(processInstanceId: String, name: String) =
        runtimeService.createVariableInstanceQuery()
            .processInstanceIdIn(processInstanceId)
            .variableName(name)
            .singleResult() as VariableInstanceEntity

    companion object {
        private val LARGE_STRING = "abcdé".repeat(1000)
    }
}
