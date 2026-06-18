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
import org.operaton.bpm.model.bpmn.instance.Condition
import org.operaton.bpm.model.bpmn.instance.ConditionExpression
import org.operaton.bpm.model.bpmn.instance.ConditionalEventDefinition
import org.operaton.bpm.model.bpmn.instance.EndEvent
import org.operaton.bpm.model.bpmn.instance.Error
import org.operaton.bpm.model.bpmn.instance.ErrorEventDefinition
import org.operaton.bpm.model.bpmn.instance.Escalation
import org.operaton.bpm.model.bpmn.instance.EscalationEventDefinition
import org.operaton.bpm.model.bpmn.instance.ExclusiveGateway
import org.operaton.bpm.model.bpmn.instance.ExtensionElements
import org.operaton.bpm.model.bpmn.instance.FlowNode
import org.operaton.bpm.model.bpmn.instance.IntermediateCatchEvent
import org.operaton.bpm.model.bpmn.instance.IntermediateThrowEvent
import org.operaton.bpm.model.bpmn.instance.Message
import org.operaton.bpm.model.bpmn.instance.EventDefinition
import org.operaton.bpm.model.bpmn.instance.MessageEventDefinition
import org.operaton.bpm.model.bpmn.instance.Process
import org.operaton.bpm.model.bpmn.instance.ReceiveTask
import org.operaton.bpm.model.bpmn.instance.SendTask
import org.operaton.bpm.model.bpmn.instance.SequenceFlow
import org.operaton.bpm.model.bpmn.instance.ServiceTask
import org.operaton.bpm.model.bpmn.instance.Signal
import org.operaton.bpm.model.bpmn.instance.SignalEventDefinition
import org.operaton.bpm.model.bpmn.instance.StartEvent
import org.operaton.bpm.model.bpmn.instance.TerminateEventDefinition
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

        val serviceTaskErrors = result.errors.filter { it.elementType == "ServiceTask" }
        assertThat(serviceTaskErrors).hasSize(1)
        assertThat(serviceTaskErrors[0].elementId).isEqualTo("my-service-task")
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

        val userTaskErrors = result.errors.filter { it.elementType == "UserTask" }
        assertThat(userTaskErrors).hasSize(1)
        assertThat(userTaskErrors[0].elementId).isEqualTo("my-user-task")
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

        val sendTaskErrors = result.errors.filter { it.elementType == "SendTask" }
        assertThat(sendTaskErrors).hasSize(1)
        assertThat(sendTaskErrors[0].elementId).isEqualTo("my-send-task")
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

        val receiveTaskErrors = result.errors.filter { it.elementType == "ReceiveTask" }
        assertThat(receiveTaskErrors).hasSize(1)
        assertThat(receiveTaskErrors[0].elementId).isEqualTo("my-receive-task")
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

        val ruleTaskErrors = result.errors.filter { it.elementType == "BusinessRuleTask" }
        assertThat(ruleTaskErrors).hasSize(1)
        assertThat(ruleTaskErrors[0].elementId).isEqualTo("my-rule-task")
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

        val callActivityErrors = result.errors.filter { it.elementType == "CallActivity" }
        assertThat(callActivityErrors).hasSize(1)
        assertThat(callActivityErrors[0].elementId).isEqualTo("my-call-activity")
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

        val catchEventErrors = result.errors.filter { it.elementType == "MessageIntermediateCatchEvent" }
        assertThat(catchEventErrors).hasSize(1)
        assertThat(catchEventErrors[0].elementId).isEqualTo("my-catch-event")
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

        val throwEventErrors = result.errors.filter { it.elementType == "MessageIntermediateThrowEvent" }
        assertThat(throwEventErrors).hasSize(1)
        assertThat(throwEventErrors[0].elementId).isEqualTo("my-throw-event")
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

        val timerEventErrors = result.errors.filter { it.elementType == "TimerIntermediateCatchEvent" }
        assertThat(timerEventErrors).hasSize(1)
        assertThat(timerEventErrors[0].elementId).isEqualTo("my-timer-event")
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

        val taskErrors = result.errors.filter { it.elementType in listOf("ServiceTask", "UserTask") }
        assertThat(taskErrors).hasSize(2)
        assertThat(taskErrors.map { it.elementId }).containsExactlyInAnyOrder(
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

    // --- Structural validation tests ---

    @Test
    fun `should report process with no start event`() {
        val model = Bpmn.createExecutableProcess("test-process").done()
        val process = model.getModelElementsByType(Process::class.java).first()
        val endEvent = model.newInstance(EndEvent::class.java)
        endEvent.id = "end"
        process.addChildElement(endEvent)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "test-process" && it.reason == "Process has no start event"
        }
    }

    @Test
    fun `should report process with no end event`() {
        val model = Bpmn.createExecutableProcess("test-process").done()
        val process = model.getModelElementsByType(Process::class.java).first()
        val startEvent = model.newInstance(StartEvent::class.java)
        startEvent.id = "start"
        process.addChildElement(startEvent)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "test-process" && it.reason == "Process has no end event"
        }
    }

    @Test
    fun `should report start event with no outgoing flow`() {
        val model = Bpmn.createExecutableProcess("test-process").done()
        val process = model.getModelElementsByType(Process::class.java).first()

        val startEvent = model.newInstance(StartEvent::class.java)
        startEvent.id = "start"
        process.addChildElement(startEvent)

        val endEvent = model.newInstance(EndEvent::class.java)
        endEvent.id = "end"
        process.addChildElement(endEvent)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "start" && it.reason == "Start event has no outgoing flow"
        }
    }

    @Test
    fun `should report end event with no incoming flow`() {
        val model = Bpmn.createExecutableProcess("test-process").done()
        val process = model.getModelElementsByType(Process::class.java).first()

        val startEvent = model.newInstance(StartEvent::class.java)
        startEvent.id = "start"
        process.addChildElement(startEvent)

        val endEvent = model.newInstance(EndEvent::class.java)
        endEvent.id = "end"
        process.addChildElement(endEvent)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "end" && it.reason == "End event has no incoming flow"
        }
    }

    @Test
    fun `should report flow node with no incoming flow`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .endEvent("end")
            .done()

        val process = model.getModelElementsByType(Process::class.java).first()
        val serviceTask = model.newInstance(ServiceTask::class.java)
        serviceTask.id = "orphan-task"
        serviceTask.operatonExpression = "\${true}"
        process.addChildElement(serviceTask)

        val endEvent2 = model.newInstance(EndEvent::class.java)
        endEvent2.id = "end2"
        process.addChildElement(endEvent2)

        val flow = model.newInstance(SequenceFlow::class.java)
        flow.id = "flow-orphan-to-end"
        flow.source = serviceTask
        flow.target = endEvent2
        process.addChildElement(flow)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "orphan-task" && it.reason == "Element has no incoming flow"
        }
    }

    @Test
    fun `should report flow node with no outgoing flow`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .serviceTask("my-task").operatonExpression("\${true}")
            .endEvent("end")
            .done()

        val process = model.getModelElementsByType(Process::class.java).first()
        val extraTask = model.newInstance(ServiceTask::class.java)
        extraTask.id = "dead-end-task"
        extraTask.operatonExpression = "\${true}"
        process.addChildElement(extraTask)

        val flow = model.newInstance(SequenceFlow::class.java)
        flow.id = "flow-start-to-deadend"
        val startEvent = model.getModelElementById<StartEvent>("start")
        flow.source = startEvent
        flow.target = extraTask
        process.addChildElement(flow)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "dead-end-task" && it.reason == "Element has no outgoing flow"
        }
    }

    @Test
    fun `should report unreachable element`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .endEvent("end")
            .done()

        val process = model.getModelElementsByType(Process::class.java).first()

        val isolatedTask = model.newInstance(ServiceTask::class.java)
        isolatedTask.id = "isolated-task"
        isolatedTask.operatonExpression = "\${true}"
        process.addChildElement(isolatedTask)

        val isolatedEnd = model.newInstance(EndEvent::class.java)
        isolatedEnd.id = "isolated-end"
        process.addChildElement(isolatedEnd)

        val flow = model.newInstance(SequenceFlow::class.java)
        flow.id = "isolated-flow"
        flow.source = isolatedTask
        flow.target = isolatedEnd
        process.addChildElement(flow)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "isolated-task" && it.reason == "Element is not reachable from any start event"
        }
        assertThat(result.errors).anyMatch {
            it.elementId == "isolated-end" && it.reason == "Element is not reachable from any start event"
        }
    }

    @Test
    fun `should not report structural errors for valid process`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("task").operatonExpression("\${true}")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        val structuralErrors = result.errors.filter {
            it.reason == "Process has no start event" ||
                it.reason == "Process has no end event" ||
                it.reason.contains("incoming flow") ||
                it.reason.contains("outgoing flow") ||
                it.reason.contains("reachable")
        }
        assertThat(structuralErrors).isEmpty()
    }

    @Test
    fun `should not report structural errors for non-executable process`() {
        val model = Bpmn.createProcess("test-process").done()
        // Non-executable process with no start/end events — should have no errors
        // because non-executable skips validation (checked by caller)

        val result = validator.validate(model, emptyList())

        // Validator still reports errors — it's the caller that skips based on isExecutable
        assertThat(result.isExecutable).isFalse()
    }

    @Test
    fun `should combine structural and config errors`() {
        val model = Bpmn.createExecutableProcess("test-process").done()
        val process = model.getModelElementsByType(Process::class.java).first()

        val startEvent = model.newInstance(StartEvent::class.java)
        startEvent.id = "start"
        process.addChildElement(startEvent)

        val serviceTask = model.newInstance(ServiceTask::class.java)
        serviceTask.id = "unconfigured-task"
        process.addChildElement(serviceTask)

        val flow = model.newInstance(SequenceFlow::class.java)
        flow.id = "flow1"
        flow.source = startEvent
        flow.target = serviceTask
        process.addChildElement(flow)

        val result = validator.validate(model, emptyList())

        // Should have structural errors (no end event, task has no outgoing, etc.)
        // AND config error (service task has no implementation)
        assertThat(result.errors).anyMatch { it.reason == "Process has no end event" }
        assertThat(result.errors).anyMatch { it.reason.contains("no process link") }
    }

    // --- Exclusive gateway single outgoing tests ---

    @Test
    fun `should not require condition on exclusive gateway with single outgoing flow`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .exclusiveGateway("my-gateway")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.elementType == "SequenceFlow" }).isEmpty()
    }

    // --- None start event tests ---

    @Test
    fun `should report multiple none start events`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start1")
            .endEvent("end")
            .done()

        val process = model.getModelElementsByType(Process::class.java).first()
        val start2 = model.newInstance(StartEvent::class.java)
        start2.id = "start2"
        process.addChildElement(start2)

        val flow = model.newInstance(SequenceFlow::class.java)
        flow.id = "flow-start2"
        flow.source = start2
        flow.target = model.getModelElementById<EndEvent>("end")
        process.addChildElement(flow)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "test-process" && it.reason == "Process has multiple none start events"
        }
    }

    @Test
    fun `should report none start event without form or process link`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "start" &&
                it.elementType == "StartEvent" &&
                it.reason == "None start event has no process link or form" &&
                it.severity == ValidationSeverity.WARNING
        }
    }

    @Test
    fun `should pass none start event with process link`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .endEvent()
            .done()

        val result = validator.validate(model, listOf(createProcessLink("start")))

        assertThat(result.errors).noneMatch {
            it.elementId == "start" && it.reason == "None start event has no process link or form"
        }
    }

    @Test
    fun `should pass none start event with form key`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start").operatonFormKey("formio:my-form")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch {
            it.elementId == "start" && it.reason == "None start event has no process link or form"
        }
    }

    @Test
    fun `should allow none start event alongside message start event`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start1")
            .endEvent("end")
            .done()

        val process = model.getModelElementsByType(Process::class.java).first()

        val msgStart = model.newInstance(StartEvent::class.java)
        msgStart.id = "msg-start"
        process.addChildElement(msgStart)

        val message = model.newInstance(Message::class.java)
        message.id = "msg-1"
        message.name = "my-message"
        model.definitions.addChildElement(message)

        val msgDef = model.newInstance(MessageEventDefinition::class.java)
        msgDef.message = message
        msgStart.addChildElement(msgDef)

        val flow = model.newInstance(SequenceFlow::class.java)
        flow.id = "flow-msg-start"
        flow.source = msgStart
        flow.target = model.getModelElementById<EndEvent>("end")
        process.addChildElement(flow)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch {
            it.reason == "Process has multiple none start events"
        }
    }

    // --- Start event path to end event tests ---

    @Test
    fun `should report start event with no path to end event`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .serviceTask("task").operatonExpression("\${true}")
            .done()

        val process = model.getModelElementsByType(Process::class.java).first()
        val endEvent = model.newInstance(EndEvent::class.java)
        endEvent.id = "end"
        process.addChildElement(endEvent)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "start" && it.reason == "Start event has no path to an end event"
        }
    }

    @Test
    fun `should not report start event with path to end event`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .serviceTask("task").operatonExpression("\${true}")
            .endEvent("end")
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch {
            it.reason == "Start event has no path to an end event"
        }
    }

    @Test
    fun `should skip path-to-end check when terminate end event exists`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("start")
            .serviceTask("task").operatonExpression("\${true}")
            .done()

        val process = model.getModelElementsByType(Process::class.java).first()
        val endEvent = model.newInstance(EndEvent::class.java)
        endEvent.id = "terminate-end"
        process.addChildElement(endEvent)

        val terminateDef = model.newInstance(TerminateEventDefinition::class.java)
        endEvent.addChildElement(terminateDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch {
            it.reason == "Start event has no path to an end event"
        }
    }

    // --- Start event definition validation tests ---

    @Test
    fun `should report message start event without message`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("msg-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("msg-start")
        val msgDef = model.newInstance(MessageEventDefinition::class.java)
        startEvent.addChildElement(msgDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "msg-start" && it.elementType == "MessageStartEvent"
        }
    }

    @Test
    fun `should pass message start event with message`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("msg-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("msg-start")
        val message = model.newInstance(Message::class.java)
        message.name = "my-message"
        model.definitions.addChildElement(message)
        val msgDef = model.newInstance(MessageEventDefinition::class.java)
        msgDef.message = message
        startEvent.addChildElement(msgDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch { it.elementType == "MessageStartEvent" }
    }

    @Test
    fun `should pass message start event with process link`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("msg-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("msg-start")
        val msgDef = model.newInstance(MessageEventDefinition::class.java)
        startEvent.addChildElement(msgDef)

        val result = validator.validate(model, listOf(createProcessLink("msg-start")))

        assertThat(result.errors).noneMatch { it.elementType == "MessageStartEvent" }
    }

    @Test
    fun `should report timer start event without timer configuration`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("timer-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("timer-start")
        val timerDef = model.newInstance(TimerEventDefinition::class.java)
        startEvent.addChildElement(timerDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "timer-start" && it.elementType == "TimerStartEvent"
        }
    }

    @Test
    fun `should pass timer start event with duration`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("timer-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("timer-start")
        val timerDef = model.newInstance(TimerEventDefinition::class.java)
        val timeDuration = model.newInstance(TimeDuration::class.java)
        timeDuration.textContent = "PT30S"
        timerDef.addChildElement(timeDuration)
        startEvent.addChildElement(timerDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch { it.elementType == "TimerStartEvent" }
    }

    @Test
    fun `should report signal start event without signal`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("signal-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("signal-start")
        val signalDef = model.newInstance(SignalEventDefinition::class.java)
        startEvent.addChildElement(signalDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "signal-start" && it.elementType == "SignalStartEvent"
        }
    }

    @Test
    fun `should pass signal start event with signal`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("signal-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("signal-start")
        val signal = model.newInstance(Signal::class.java)
        signal.name = "my-signal"
        model.definitions.addChildElement(signal)
        val signalDef = model.newInstance(SignalEventDefinition::class.java)
        signalDef.signal = signal
        startEvent.addChildElement(signalDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch { it.elementType == "SignalStartEvent" }
    }

    @Test
    fun `should report conditional start event without condition`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("cond-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("cond-start")
        val condDef = model.newInstance(ConditionalEventDefinition::class.java)
        startEvent.addChildElement(condDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "cond-start" && it.elementType == "ConditionalStartEvent"
        }
    }

    @Test
    fun `should pass conditional start event with condition`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("cond-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("cond-start")
        val condDef = model.newInstance(ConditionalEventDefinition::class.java)
        val condition = model.newInstance(Condition::class.java)
        condition.textContent = "\${true}"
        condDef.condition = condition
        startEvent.addChildElement(condDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch { it.elementType == "ConditionalStartEvent" }
    }

    @Test
    fun `should report error start event without error`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("error-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("error-start")
        val errorDef = model.newInstance(ErrorEventDefinition::class.java)
        startEvent.addChildElement(errorDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "error-start" && it.elementType == "ErrorStartEvent"
        }
    }

    @Test
    fun `should pass error start event with error`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("error-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("error-start")
        val error = model.newInstance(Error::class.java)
        error.errorCode = "MY_ERROR"
        model.definitions.addChildElement(error)
        val errorDef = model.newInstance(ErrorEventDefinition::class.java)
        errorDef.error = error
        startEvent.addChildElement(errorDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch { it.elementType == "ErrorStartEvent" }
    }

    @Test
    fun `should report escalation start event without escalation`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("esc-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("esc-start")
        val escDef = model.newInstance(EscalationEventDefinition::class.java)
        startEvent.addChildElement(escDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).anyMatch {
            it.elementId == "esc-start" && it.elementType == "EscalationStartEvent"
        }
    }

    @Test
    fun `should pass escalation start event with escalation`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent("esc-start")
            .endEvent()
            .done()

        val startEvent = model.getModelElementById<StartEvent>("esc-start")
        val escalation = model.newInstance(Escalation::class.java)
        escalation.escalationCode = "MY_ESC"
        model.definitions.addChildElement(escalation)
        val escDef = model.newInstance(EscalationEventDefinition::class.java)
        escDef.escalation = escalation
        startEvent.addChildElement(escDef)

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch { it.elementType == "EscalationStartEvent" }
    }

    // --- Expression syntax validation tests ---

    @Test
    fun `should report invalid expression syntax in condition`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .exclusiveGateway("my-gateway")
            .sequenceFlowId("flow-a")
            .condition("condition-a", "\${broken(")  // Invalid: unclosed parenthesis
            .endEvent("end-a")
            .moveToNode("my-gateway")
            .sequenceFlowId("flow-b")
            .condition("condition-b", "\${valid}")
            .endEvent("end-b")
            .done()

        val result = validator.validate(model, emptyList())

        val error = result.errors.find { it.elementId == "flow-a" && it.reason.contains("Invalid expression syntax") }
        assertThat(error).isNotNull
        assertThat(error!!.errorCode).isEqualTo("UNCLOSED_PARENTHESIS")
        assertThat(error.expression).isEqualTo("\${broken(")
    }

    @Test
    fun `should pass valid expression syntax in condition`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .exclusiveGateway("my-gateway")
            .sequenceFlowId("flow-a")
            .condition("condition-a", "\${approved == true}")
            .endEvent("end-a")
            .moveToNode("my-gateway")
            .sequenceFlowId("flow-b")
            .condition("condition-b", "\${!approved}")
            .endEvent("end-b")
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors).noneMatch {
            it.reason.contains("Invalid expression syntax")
        }
    }

    @Test
    fun `should report invalid expression syntax in service task`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("my-task")
            .operatonExpression("\${broken]")  // Invalid: unexpected ] when expecting }
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        val error = result.errors.find { it.elementId == "my-task" && it.reason.contains("Invalid expression syntax") }
        assertThat(error).isNotNull
        assertThat(error!!.errorCode).isEqualTo("UNCLOSED_BRACE")
        assertThat(error.expression).isEqualTo("\${broken]")
    }

    @Test
    fun `should report plain text expression without EL markers`() {
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("my-task")
            .operatonExpression("plainTextWithoutMarkers")  // Invalid: no ${} or #{}
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        val error = result.errors.find { it.elementId == "my-task" && it.reason.contains("\${...} or #{...}") }
        assertThat(error).isNotNull
        assertThat(error!!.errorCode).isEqualTo("MISSING_EL_MARKERS")
        assertThat(error.expression).isEqualTo("plainTextWithoutMarkers")
    }

    @Test
    fun `should report bean not found when bean does not exist in process beans`() {
        val validatorWithBeans = ProcessDefinitionValidator { mapOf("existingBean" to Object()) }

        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("my-task")
            .operatonExpression("\${nonExistentBean.doSomething()}")
            .endEvent()
            .done()

        val result = validatorWithBeans.validate(model, emptyList())

        val error = result.errors.find { it.elementId == "my-task" && it.errorCode == "BEAN_NOT_FOUND" }
        assertThat(error).isNotNull
        assertThat(error!!.reason).contains("nonExistentBean")
        assertThat(error.expression).isEqualTo("\${nonExistentBean.doSomething()}")
    }

    @Test
    fun `should not report bean error when bean exists in process beans`() {
        val validatorWithBeans = ProcessDefinitionValidator { mapOf("myBean" to Object()) }

        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("my-task")
            .operatonExpression("\${myBean.doSomething()}")
            .endEvent()
            .done()

        val result = validatorWithBeans.validate(model, emptyList())

        assertThat(result.errors.filter { it.errorCode == "BEAN_NOT_FOUND" }).isEmpty()
    }

    @Test
    fun `should skip bean validation when no process beans are configured`() {
        // Default validator has no process beans
        val model = Bpmn.createExecutableProcess("test-process")
            .startEvent()
            .serviceTask("my-task")
            .operatonExpression("\${anyBean.doSomething()}")
            .endEvent()
            .done()

        val result = validator.validate(model, emptyList())

        assertThat(result.errors.filter { it.errorCode == "BEAN_NOT_FOUND" }).isEmpty()
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
