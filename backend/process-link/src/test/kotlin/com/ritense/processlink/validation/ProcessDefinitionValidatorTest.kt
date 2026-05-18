/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.processlink.validation

import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.TestProcessLinkCreateRequestDto
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.BusinessRuleTask
import org.operaton.bpm.model.bpmn.instance.CallActivity
import org.operaton.bpm.model.bpmn.instance.ConditionExpression
import org.operaton.bpm.model.bpmn.instance.ExclusiveGateway
import org.operaton.bpm.model.bpmn.instance.ExtensionElements
import org.operaton.bpm.model.bpmn.instance.IntermediateCatchEvent
import org.operaton.bpm.model.bpmn.instance.IntermediateThrowEvent
import org.operaton.bpm.model.bpmn.instance.Message
import org.operaton.bpm.model.bpmn.instance.MessageEventDefinition
import org.operaton.bpm.model.bpmn.instance.Process
import org.operaton.bpm.model.bpmn.instance.ReceiveTask
import org.operaton.bpm.model.bpmn.instance.SendTask
import org.operaton.bpm.model.bpmn.instance.SequenceFlow
import org.operaton.bpm.model.bpmn.instance.ServiceTask
import org.operaton.bpm.model.bpmn.instance.TimeDuration
import org.operaton.bpm.model.bpmn.instance.TimerEventDefinition
import org.operaton.bpm.model.bpmn.instance.UserTask
import org.operaton.bpm.model.bpmn.instance.operaton.OperatonExecutionListener

class ProcessDefinitionValidatorTest {

    private lateinit var validator: ProcessDefinitionValidator

    @BeforeEach
    fun setUp() {
        validator = ProcessDefinitionValidator()
    }

    @Test
    fun `should detect executable process`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.isExecutable).isTrue()
    }

    @Test
    fun `should detect non-executable process`() {
        val model = Bpmn.createProcess("test-process")
            .startEvent()
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.isExecutable).isFalse()
    }

    @Test
    fun `should report service task without configuration`() {
        val model = createModelWithServiceTask(id = "my-service-task")

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).hasSize(1)
        assertThat(result.errors[0].elementId).isEqualTo("my-service-task")
        assertThat(result.errors[0].elementType).isEqualTo("ServiceTask")
    }

    @Test
    fun `should pass service task with process link`() {
        val model = createModelWithServiceTask(id = "my-service-task")
        val processLinks = listOf(createProcessLink("my-service-task"))

        val result = validator.validate(model, processLinks)

        assertThat(result.errors.filter { it.elementType == "ServiceTask" }).isEmpty()
    }

    @Test
    fun `should pass service task with implementation`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("my-service-task").operatonExpression("\${myBean.execute()}")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "ServiceTask" }).isEmpty()
    }

    @Test
    fun `should pass service task with delegate expression`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("my-service-task").operatonDelegateExpression("\${myDelegate}")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "ServiceTask" }).isEmpty()
    }

    @Test
    fun `should pass service task with class`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("my-service-task").operatonClass("com.example.MyDelegate")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "ServiceTask" }).isEmpty()
    }

    @Test
    fun `should pass service task with execution listener`() {
        val model = createModelWithServiceTask(id = "my-service-task")

        val serviceTask = model.getModelElementById<ServiceTask>("my-service-task")
        val extensionElements = model.newInstance(ExtensionElements::class.java)
        serviceTask.addChildElement(extensionElements)
        val listener = model.newInstance(OperatonExecutionListener::class.java)
        listener.operatonEvent = "start"
        listener.operatonClass = "com.example.MyListener"
        extensionElements.addChildElement(listener)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "ServiceTask" }).isEmpty()
    }

    @Test
    fun `should report user task without configuration`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .userTask("my-user-task")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).hasSize(1)
        assertThat(result.errors[0].elementId).isEqualTo("my-user-task")
        assertThat(result.errors[0].elementType).isEqualTo("UserTask")
    }

    @Test
    fun `should pass user task with process link`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .userTask("my-user-task")
            .endEvent()
            .done()
        val processLinks = listOf(createProcessLink("my-user-task"))

        val result = validator.validate(model, processLinks)

        assertThat(result.errors.filter { it.elementType == "UserTask" }).isEmpty()
    }

    @Test
    fun `should pass user task with form key`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .userTask("my-user-task").operatonFormKey("formio:my-form")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "UserTask" }).isEmpty()
    }

    @Test
    fun `should report send task without configuration`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .sendTask("my-send-task")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).hasSize(1)
        assertThat(result.errors[0].elementId).isEqualTo("my-send-task")
        assertThat(result.errors[0].elementType).isEqualTo("SendTask")
    }

    @Test
    fun `should pass send task with process link`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .sendTask("my-send-task")
            .endEvent()
            .done()
        val processLinks = listOf(createProcessLink("my-send-task"))

        val result = validator.validate(model, processLinks)

        assertThat(result.errors.filter { it.elementType == "SendTask" }).isEmpty()
    }

    @Test
    fun `should pass send task with implementation`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .sendTask("my-send-task").operatonExpression("\${myBean.send()}")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "SendTask" }).isEmpty()
    }

    @Test
    fun `should report receive task without configuration`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .receiveTask("my-receive-task")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).hasSize(1)
        assertThat(result.errors[0].elementId).isEqualTo("my-receive-task")
        assertThat(result.errors[0].elementType).isEqualTo("ReceiveTask")
    }

    @Test
    fun `should pass receive task with process link`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .receiveTask("my-receive-task")
            .endEvent()
            .done()
        val processLinks = listOf(createProcessLink("my-receive-task"))

        val result = validator.validate(model, processLinks)

        assertThat(result.errors.filter { it.elementType == "ReceiveTask" }).isEmpty()
    }

    @Test
    fun `should pass receive task with message`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .receiveTask("my-receive-task").message("my-message")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "ReceiveTask" }).isEmpty()
    }

    @Test
    fun `should report business rule task without implementation`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .businessRuleTask("my-rule-task")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).hasSize(1)
        assertThat(result.errors[0].elementId).isEqualTo("my-rule-task")
        assertThat(result.errors[0].elementType).isEqualTo("BusinessRuleTask")
    }

    @Test
    fun `should pass business rule task with decision ref`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .businessRuleTask("my-rule-task").operatonDecisionRef("my-decision")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "BusinessRuleTask" }).isEmpty()
    }

    @Test
    fun `should report call activity without configuration`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .callActivity("my-call-activity")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).hasSize(1)
        assertThat(result.errors[0].elementId).isEqualTo("my-call-activity")
        assertThat(result.errors[0].elementType).isEqualTo("CallActivity")
    }

    @Test
    fun `should pass call activity with called element`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .callActivity("my-call-activity").calledElement("sub-process")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "CallActivity" }).isEmpty()
    }

    @Test
    fun `should pass call activity with process link`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .callActivity("my-call-activity")
            .endEvent()
            .done()
        val processLinks = listOf(createProcessLink("my-call-activity"))

        val result = validator.validate(model, processLinks)

        assertThat(result.errors.filter { it.elementType == "CallActivity" }).isEmpty()
    }

    @Test
    fun `should report sequence flow from exclusive gateway without condition`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .exclusiveGateway("my-gateway")
            .sequenceFlowId("flow-a")
            .endEvent("end-a")
            .moveToNode("my-gateway")
            .sequenceFlowId("flow-b")
            .endEvent("end-b")
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "SequenceFlow" }).hasSize(2)
    }

    @Test
    fun `should pass sequence flow from exclusive gateway with condition`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .exclusiveGateway("my-gateway")
            .sequenceFlowId("flow-a")
            .condition("condition-a", "\${approved}")
            .endEvent("end-a")
            .moveToNode("my-gateway")
            .sequenceFlowId("flow-b")
            .condition("condition-b", "\${!approved}")
            .endEvent("end-b")
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "SequenceFlow" }).isEmpty()
    }

    @Test
    fun `should skip default flow from exclusive gateway`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .exclusiveGateway("my-gateway")
            .sequenceFlowId("flow-a")
            .condition("condition-a", "\${approved}")
            .endEvent("end-a")
            .moveToNode("my-gateway")
            .sequenceFlowId("flow-b")
            .endEvent("end-b")
            .done()

        val gateway = model.getModelElementById<ExclusiveGateway>("my-gateway")
        val defaultFlow = model.getModelElementById<SequenceFlow>("flow-b")
        gateway.default = defaultFlow

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "SequenceFlow" }).isEmpty()
    }

    @Test
    fun `should report message intermediate catch event without configuration`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .intermediateCatchEvent("my-catch-event")
            .endEvent()
            .done()

        val catchEvent = model.getModelElementById<IntermediateCatchEvent>("my-catch-event")
        val msgDef = model.newInstance(MessageEventDefinition::class.java)
        catchEvent.addChildElement(msgDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).hasSize(1)
        assertThat(result.errors[0].elementId).isEqualTo("my-catch-event")
        assertThat(result.errors[0].elementType).isEqualTo("MessageIntermediateCatchEvent")
    }

    @Test
    fun `should pass message intermediate catch event with message`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .intermediateCatchEvent("my-catch-event")
            .endEvent()
            .done()

        val catchEvent = model.getModelElementById<IntermediateCatchEvent>("my-catch-event")
        val message = model.newInstance(Message::class.java)
        message.name = "my-message"
        model.definitions.addChildElement(message)
        val msgDef = model.newInstance(MessageEventDefinition::class.java)
        msgDef.message = message
        catchEvent.addChildElement(msgDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "MessageIntermediateCatchEvent" }).isEmpty()
    }

    @Test
    fun `should pass message intermediate catch event with process link`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .intermediateCatchEvent("my-catch-event")
            .endEvent()
            .done()

        val catchEvent = model.getModelElementById<IntermediateCatchEvent>("my-catch-event")
        val msgDef = model.newInstance(MessageEventDefinition::class.java)
        catchEvent.addChildElement(msgDef)

        val processLinks = listOf(createProcessLink("my-catch-event"))
        val result = validator.validate(model, processLinks)

        assertThat(result.errors.filter { it.elementType == "MessageIntermediateCatchEvent" }).isEmpty()
    }

    @Test
    fun `should report message intermediate throw event without configuration`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .intermediateThrowEvent("my-throw-event")
            .endEvent()
            .done()

        val throwEvent = model.getModelElementById<IntermediateThrowEvent>("my-throw-event")
        val msgDef = model.newInstance(MessageEventDefinition::class.java)
        throwEvent.addChildElement(msgDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).hasSize(1)
        assertThat(result.errors[0].elementId).isEqualTo("my-throw-event")
        assertThat(result.errors[0].elementType).isEqualTo("MessageIntermediateThrowEvent")
    }

    @Test
    fun `should pass message intermediate throw event with message`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .intermediateThrowEvent("my-throw-event")
            .endEvent()
            .done()

        val throwEvent = model.getModelElementById<IntermediateThrowEvent>("my-throw-event")
        val message = model.newInstance(Message::class.java)
        message.name = "my-message"
        model.definitions.addChildElement(message)
        val msgDef = model.newInstance(MessageEventDefinition::class.java)
        msgDef.message = message
        throwEvent.addChildElement(msgDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "MessageIntermediateThrowEvent" }).isEmpty()
    }

    @Test
    fun `should report timer intermediate catch event without timer`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .intermediateCatchEvent("my-timer-event")
            .endEvent()
            .done()

        val catchEvent = model.getModelElementById<IntermediateCatchEvent>("my-timer-event")
        val timerDef = model.newInstance(TimerEventDefinition::class.java)
        catchEvent.addChildElement(timerDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).hasSize(1)
        assertThat(result.errors[0].elementId).isEqualTo("my-timer-event")
        assertThat(result.errors[0].elementType).isEqualTo("TimerIntermediateCatchEvent")
    }

    @Test
    fun `should pass timer intermediate catch event with duration`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .intermediateCatchEvent("my-timer-event")
            .endEvent()
            .done()

        val catchEvent = model.getModelElementById<IntermediateCatchEvent>("my-timer-event")
        val timerDef = model.newInstance(TimerEventDefinition::class.java)
        val timeDuration = model.newInstance(TimeDuration::class.java)
        timeDuration.textContent = "PT30S"
        timerDef.addChildElement(timeDuration)
        catchEvent.addChildElement(timerDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "TimerIntermediateCatchEvent" }).isEmpty()
    }

    @Test
    fun `should report multiple errors at once`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("unconfigured-service")
            .userTask("unconfigured-user")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).hasSize(2)
        assertThat(result.errors.map { it.elementId }).containsExactlyInAnyOrder(
            "unconfigured-service",
            "unconfigured-user"
        )
    }

    @Test
    fun `should return valid result for fully configured process`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("configured-service").operatonExpression("\${myBean.run()}")
            .userTask("configured-user").operatonFormKey("formio:my-form")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.isValid).isTrue()
        assertThat(result.isExecutable).isTrue()
    }

    private fun createModelWithServiceTask(id: String): BpmnModelInstance {
        return Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask(id)
            .endEvent()
            .done()
    }

    private fun createProcessLink(activityId: String): ProcessLinkCreateRequestDto {
        return TestProcessLinkCreateRequestDto(
            processDefinitionId = "test-process:1:1",
            activityId = activityId,
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START
        )
    }
}
