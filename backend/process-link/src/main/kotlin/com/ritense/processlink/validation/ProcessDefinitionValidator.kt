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

import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.BusinessRuleTask
import org.operaton.bpm.model.bpmn.instance.CallActivity
import org.operaton.bpm.model.bpmn.instance.ExclusiveGateway
import org.operaton.bpm.model.bpmn.instance.IntermediateCatchEvent
import org.operaton.bpm.model.bpmn.instance.IntermediateThrowEvent
import org.operaton.bpm.model.bpmn.instance.MessageEventDefinition
import org.operaton.bpm.model.bpmn.instance.Process
import org.operaton.bpm.model.bpmn.instance.ReceiveTask
import org.operaton.bpm.model.bpmn.instance.SendTask
import org.operaton.bpm.model.bpmn.instance.SequenceFlow
import org.operaton.bpm.model.bpmn.instance.ServiceTask
import org.operaton.bpm.model.bpmn.instance.TimerEventDefinition
import org.operaton.bpm.model.bpmn.instance.UserTask
import org.operaton.bpm.model.bpmn.instance.operaton.OperatonExecutionListener

class ProcessDefinitionValidator {

    fun validate(
        bpmnModel: BpmnModelInstance,
        processLinks: List<ProcessLinkCreateRequestDto>
    ): ProcessDefinitionValidationResult {
        val processLinkActivityIds = processLinks.map { it.activityId }.toSet()
        val errors = mutableListOf<ProcessDefinitionValidationError>()

        val isExecutable = bpmnModel.getDefinitions()
            .getChildElementsByType(Process::class.java)
            .any { it.isExecutable }

        validateServiceTasks(bpmnModel, processLinkActivityIds, errors)
        validateUserTasks(bpmnModel, processLinkActivityIds, errors)
        validateSendTasks(bpmnModel, processLinkActivityIds, errors)
        validateReceiveTasks(bpmnModel, processLinkActivityIds, errors)
        validateBusinessRuleTasks(bpmnModel, errors)
        validateCallActivities(bpmnModel, processLinkActivityIds, errors)
        validateSequenceFlowsFromExclusiveGateway(bpmnModel, errors)
        validateMessageIntermediateCatchEvents(bpmnModel, processLinkActivityIds, errors)
        validateMessageIntermediateThrowEvents(bpmnModel, processLinkActivityIds, errors)
        validateTimerIntermediateCatchEvents(bpmnModel, errors)

        return ProcessDefinitionValidationResult(
            isExecutable = isExecutable,
            errors = errors
        )
    }

    private fun validateServiceTasks(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(ServiceTask::class.java).forEach { task ->
            if (processLinkActivityIds.contains(task.id)) return@forEach
            if (hasImplementation(task)) return@forEach
            if (hasExecutionListener(task)) return@forEach

            errors.add(
                ProcessDefinitionValidationError(
                    elementId = task.id,
                    elementType = "ServiceTask",
                    elementName = task.name,
                    reason = "Service task has no process link, implementation, or execution listener"
                )
            )
        }
    }

    private fun validateUserTasks(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(UserTask::class.java).forEach { task ->
            if (processLinkActivityIds.contains(task.id)) return@forEach
            if (task.operatonFormKey != null || task.operatonFormRef != null) return@forEach

            errors.add(
                ProcessDefinitionValidationError(
                    elementId = task.id,
                    elementType = "UserTask",
                    elementName = task.name,
                    reason = "User task has no process link or form"
                )
            )
        }
    }

    private fun validateSendTasks(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(SendTask::class.java).forEach { task ->
            if (processLinkActivityIds.contains(task.id)) return@forEach
            if (hasImplementation(task)) return@forEach

            errors.add(
                ProcessDefinitionValidationError(
                    elementId = task.id,
                    elementType = "SendTask",
                    elementName = task.name,
                    reason = "Send task has no process link or implementation"
                )
            )
        }
    }

    private fun validateReceiveTasks(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(ReceiveTask::class.java).forEach { task ->
            if (processLinkActivityIds.contains(task.id)) return@forEach
            if (task.message != null) return@forEach

            errors.add(
                ProcessDefinitionValidationError(
                    elementId = task.id,
                    elementType = "ReceiveTask",
                    elementName = task.name,
                    reason = "Receive task has no process link or message"
                )
            )
        }
    }

    private fun validateBusinessRuleTasks(
        bpmnModel: BpmnModelInstance,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(BusinessRuleTask::class.java).forEach { task ->
            if (task.operatonDecisionRef != null) return@forEach

            errors.add(
                ProcessDefinitionValidationError(
                    elementId = task.id,
                    elementType = "BusinessRuleTask",
                    elementName = task.name,
                    reason = "Business rule task has no implementation"
                )
            )
        }
    }

    private fun validateCallActivities(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(CallActivity::class.java).forEach { callActivity ->
            if (processLinkActivityIds.contains(callActivity.id)) return@forEach
            if (callActivity.calledElement != null) return@forEach

            errors.add(
                ProcessDefinitionValidationError(
                    elementId = callActivity.id,
                    elementType = "CallActivity",
                    elementName = callActivity.name,
                    reason = "Call activity has no process link or called element"
                )
            )
        }
    }

    private fun validateSequenceFlowsFromExclusiveGateway(
        bpmnModel: BpmnModelInstance,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        val defaultFlowIds = bpmnModel.getModelElementsByType(ExclusiveGateway::class.java)
            .mapNotNull { it.default?.id }
            .toSet()

        bpmnModel.getModelElementsByType(SequenceFlow::class.java).forEach { flow ->
            if (flow.source !is ExclusiveGateway) return@forEach
            if (defaultFlowIds.contains(flow.id)) return@forEach
            if (flow.conditionExpression != null) return@forEach

            errors.add(
                ProcessDefinitionValidationError(
                    elementId = flow.id,
                    elementType = "SequenceFlow",
                    elementName = flow.name,
                    reason = "Sequence flow from exclusive gateway has no condition"
                )
            )
        }
    }

    private fun validateMessageIntermediateCatchEvents(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(IntermediateCatchEvent::class.java)
            .filter { it.getChildElementsByType(MessageEventDefinition::class.java).isNotEmpty() }
            .forEach { event ->
                if (processLinkActivityIds.contains(event.id)) return@forEach
                val hasMessage = event.getChildElementsByType(MessageEventDefinition::class.java)
                    .any { it.message != null }
                if (hasMessage) return@forEach

                errors.add(
                    ProcessDefinitionValidationError(
                        elementId = event.id,
                        elementType = "MessageIntermediateCatchEvent",
                        elementName = event.name,
                        reason = "Message intermediate catch event has no process link or message"
                    )
                )
            }
    }

    private fun validateMessageIntermediateThrowEvents(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(IntermediateThrowEvent::class.java)
            .filter { it.getChildElementsByType(MessageEventDefinition::class.java).isNotEmpty() }
            .forEach { event ->
                if (processLinkActivityIds.contains(event.id)) return@forEach
                val hasMessage = event.getChildElementsByType(MessageEventDefinition::class.java)
                    .any { it.message != null }
                if (hasMessage) return@forEach

                errors.add(
                    ProcessDefinitionValidationError(
                        elementId = event.id,
                        elementType = "MessageIntermediateThrowEvent",
                        elementName = event.name,
                        reason = "Message intermediate throw event has no process link or message"
                    )
                )
            }
    }

    private fun validateTimerIntermediateCatchEvents(
        bpmnModel: BpmnModelInstance,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(IntermediateCatchEvent::class.java)
            .filter { it.getChildElementsByType(TimerEventDefinition::class.java).isNotEmpty() }
            .forEach { event ->
                val hasTimer = event.getChildElementsByType(TimerEventDefinition::class.java)
                    .any { it.timeDate != null || it.timeDuration != null || it.timeCycle != null }
                if (hasTimer) return@forEach

                errors.add(
                    ProcessDefinitionValidationError(
                        elementId = event.id,
                        elementType = "TimerIntermediateCatchEvent",
                        elementName = event.name,
                        reason = "Timer intermediate catch event has no timer configuration"
                    )
                )
            }
    }

    private fun hasImplementation(task: ServiceTask): Boolean {
        return task.operatonType != null
            || task.operatonClass != null
            || task.operatonExpression != null
            || task.operatonDelegateExpression != null
    }

    private fun hasImplementation(task: SendTask): Boolean {
        return task.operatonType != null
            || task.operatonClass != null
            || task.operatonExpression != null
            || task.operatonDelegateExpression != null
    }

    private fun hasExecutionListener(task: ServiceTask): Boolean {
        val extensionElements = task.extensionElements ?: return false
        return extensionElements.elementsQuery
            .filterByType(OperatonExecutionListener::class.java)
            .list()
            .isNotEmpty()
    }
}
