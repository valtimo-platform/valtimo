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
import org.operaton.bpm.impl.juel.Builder
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.BusinessRuleTask
import org.operaton.bpm.model.bpmn.instance.CallActivity
import org.operaton.bpm.model.bpmn.instance.ConditionalEventDefinition
import org.operaton.bpm.model.bpmn.instance.EndEvent
import org.operaton.bpm.model.bpmn.instance.ErrorEventDefinition
import org.operaton.bpm.model.bpmn.instance.EscalationEventDefinition
import org.operaton.bpm.model.bpmn.instance.EventDefinition
import org.operaton.bpm.model.bpmn.instance.ExclusiveGateway
import org.operaton.bpm.model.bpmn.instance.FlowNode
import org.operaton.bpm.model.bpmn.instance.IntermediateCatchEvent
import org.operaton.bpm.model.bpmn.instance.IntermediateThrowEvent
import org.operaton.bpm.model.bpmn.instance.MessageEventDefinition
import org.operaton.bpm.model.bpmn.instance.Participant
import org.operaton.bpm.model.bpmn.instance.Process
import org.operaton.bpm.model.bpmn.instance.ReceiveTask
import org.operaton.bpm.model.bpmn.instance.SendTask
import org.operaton.bpm.model.bpmn.instance.SequenceFlow
import org.operaton.bpm.model.bpmn.instance.ServiceTask
import org.operaton.bpm.model.bpmn.instance.SignalEventDefinition
import org.operaton.bpm.model.bpmn.instance.StartEvent
import org.operaton.bpm.model.bpmn.instance.TerminateEventDefinition
import org.operaton.bpm.model.bpmn.instance.TimerEventDefinition
import org.operaton.bpm.model.bpmn.instance.UserTask
import org.operaton.bpm.model.bpmn.instance.operaton.OperatonExecutionListener
import java.util.function.Supplier

class ProcessDefinitionValidator(
    private val processBeansSupplier: Supplier<Map<String, Any>> = Supplier { emptyMap() }
) {
    private val treeBuilder = Builder(Builder.Feature.METHOD_INVOCATIONS)
    private val beanNameRegex = Regex("""[\$#]\{(\w+)[\.\(\}]""")

    fun validate(
        bpmnModel: BpmnModelInstance,
        processLinks: List<ProcessLinkCreateRequestDto>
    ): ProcessDefinitionValidationResult {
        val processLinkActivityIds = processLinks.map { it.activityId }.toSet()
        val errors = mutableListOf<ProcessDefinitionValidationError>()

        val isExecutable = bpmnModel.getDefinitions()
            .getChildElementsByType(Process::class.java)
            .any { it.isExecutable }

        validateStructure(bpmnModel, errors)
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
        validateStartEventDefinitions(bpmnModel, processLinkActivityIds, errors)
        validateNoneStartEvents(bpmnModel, processLinkActivityIds, errors)

        return ProcessDefinitionValidationResult(
            isExecutable = isExecutable,
            errors = errors
        )
    }

    private fun validateStructure(
        bpmnModel: BpmnModelInstance,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        val participants = bpmnModel.getModelElementsByType(Participant::class.java)
        val processToParticipant = participants.associateBy { it.process }

        val processes = bpmnModel.getDefinitions().getChildElementsByType(Process::class.java)
        for (process in processes) {
            val participant = processToParticipant[process]
            validateStartAndEndEvents(process, participant, errors)
            validateSingleNoneStartEvent(process, participant, errors)
            validateFlowNodeConnections(process, errors)
            validateReachability(process, errors)
            validateStartEventPathsToEndEvent(process, errors)
        }
    }

    private fun processElementId(process: Process, participant: Participant?): String =
        participant?.id ?: process.id

    private fun processElementType(participant: Participant?): String =
        if (participant != null) "Participant" else "Process"

    private fun processElementName(process: Process, participant: Participant?): String? =
        participant?.name ?: process.name

    private fun validateStartAndEndEvents(
        process: Process,
        participant: Participant?,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        val startEvents = process.getChildElementsByType(StartEvent::class.java)
        if (startEvents.isEmpty()) {
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = processElementId(process, participant),
                    elementType = processElementType(participant),
                    elementName = processElementName(process, participant),
                    reason = "Process has no start event"
                )
            )
        }

        val endEvents = process.getChildElementsByType(EndEvent::class.java)
        if (endEvents.isEmpty()) {
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = processElementId(process, participant),
                    elementType = processElementType(participant),
                    elementName = processElementName(process, participant),
                    reason = "Process has no end event"
                )
            )
        }
    }

    private fun validateFlowNodeConnections(
        process: Process,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        process.getChildElementsByType(FlowNode::class.java).forEach { node ->
            if (node is StartEvent) {
                if (node.getOutgoing().isEmpty()) {
                    errors.add(
                        ProcessDefinitionValidationError(
                            elementId = node.id,
                            elementType = node.elementType.typeName,
                            elementName = node.name,
                            reason = "Start event has no outgoing flow"
                        )
                    )
                }
            } else if (node is EndEvent) {
                if (node.getIncoming().isEmpty()) {
                    errors.add(
                        ProcessDefinitionValidationError(
                            elementId = node.id,
                            elementType = node.elementType.typeName,
                            elementName = node.name,
                            reason = "End event has no incoming flow"
                        )
                    )
                }
            } else {
                if (node.getIncoming().isEmpty()) {
                    errors.add(
                        ProcessDefinitionValidationError(
                            elementId = node.id,
                            elementType = node.elementType.typeName,
                            elementName = node.name,
                            reason = "Element has no incoming flow",
                        )
                    )
                }
                if (node.getOutgoing().isEmpty()) {
                    errors.add(
                        ProcessDefinitionValidationError(
                            elementId = node.id,
                            elementType = node.elementType.typeName,
                            elementName = node.name,
                            reason = "Element has no outgoing flow",
                        )
                    )
                }
            }
        }
    }

    private fun validateReachability(
        process: Process,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        val allFlowNodes = process.getChildElementsByType(FlowNode::class.java)
        val startEvents = process.getChildElementsByType(StartEvent::class.java)

        val visited = mutableSetOf<String>()
        val queue = ArrayDeque<FlowNode>()

        startEvents.forEach { queue.add(it) }

        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            if (!visited.add(current.id)) continue
            current.getOutgoing().forEach { flow ->
                if (!visited.contains(flow.target.id)) {
                    queue.add(flow.target)
                }
            }
        }

        allFlowNodes.forEach { node ->
            if (!visited.contains(node.id)) {
                errors.add(
                    ProcessDefinitionValidationError(
                        elementId = node.id,
                        elementType = node.elementType.typeName,
                        elementName = node.name,
                        reason = "Element is not reachable from any start event",
                        severity = ValidationSeverity.WARNING
                    )
                )
            }
        }
    }

    private fun validateSingleNoneStartEvent(
        process: Process,
        participant: Participant?,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        val noneStartEvents = process.getChildElementsByType(StartEvent::class.java)
            .filter { it.getChildElementsByType(EventDefinition::class.java).isEmpty() }

        if (noneStartEvents.size > 1) {
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = processElementId(process, participant),
                    elementType = processElementType(participant),
                    elementName = processElementName(process, participant),
                    reason = "Process has multiple none start events",
                )
            )
        }
    }

    private fun validateStartEventPathsToEndEvent(
        process: Process,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        val endEvents = process.getChildElementsByType(EndEvent::class.java)
        val hasTerminateEndEvent = endEvents.any { endEvent ->
            endEvent.getChildElementsByType(TerminateEventDefinition::class.java).isNotEmpty()
        }
        if (hasTerminateEndEvent) return

        val startEvents = process.getChildElementsByType(StartEvent::class.java)
        for (startEvent in startEvents) {
            val visited = mutableSetOf<String>()
            val queue = ArrayDeque<FlowNode>()
            queue.add(startEvent)
            var reachesEndEvent = false

            while (queue.isNotEmpty()) {
                val current = queue.removeFirst()
                if (!visited.add(current.id)) continue
                if (current is EndEvent) {
                    reachesEndEvent = true
                    break
                }
                current.getOutgoing().forEach { flow ->
                    if (!visited.contains(flow.target.id)) {
                        queue.add(flow.target)
                    }
                }
            }

            if (!reachesEndEvent) {
                errors.add(
                    ProcessDefinitionValidationError(
                        elementId = startEvent.id,
                        elementType = startEvent.elementType.typeName,
                        elementName = startEvent.name,
                        reason = "Start event has no path to an end event"
                    )
                )
            }
        }
    }

    private fun validateServiceTasks(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(ServiceTask::class.java).forEach { task ->
            // Validate expression syntax
            validateExpression(task.operatonExpression, task.id, "ServiceTask", task.name, errors)
            validateExpression(task.operatonDelegateExpression, task.id, "ServiceTask", task.name, errors)

            if (processLinkActivityIds.contains(task.id)) return@forEach
            if (hasImplementation(task)) return@forEach
            if (hasExecutionListener(task)) return@forEach

            errors.add(
                ProcessDefinitionValidationError(
                    elementId = task.id,
                    elementType = "ServiceTask",
                    elementName = task.name,
                    reason = "Service task has no process link, implementation, or execution listener",
                    severity = ValidationSeverity.WARNING
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
                    reason = "User task has no process link or form",
                    severity = ValidationSeverity.WARNING
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
            // Validate expression syntax
            validateExpression(task.operatonExpression, task.id, "SendTask", task.name, errors)
            validateExpression(task.operatonDelegateExpression, task.id, "SendTask", task.name, errors)

            if (processLinkActivityIds.contains(task.id)) return@forEach
            if (hasImplementation(task)) return@forEach

            errors.add(
                ProcessDefinitionValidationError(
                    elementId = task.id,
                    elementType = "SendTask",
                    elementName = task.name,
                    reason = "Send task has no process link or implementation",
                    severity = ValidationSeverity.WARNING
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
                    reason = "Receive task has no process link or message",
                    severity = ValidationSeverity.WARNING
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
                    reason = "Business rule task has no implementation",
                    severity = ValidationSeverity.WARNING
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
                    reason = "Call activity has no process link or called element",
                    severity = ValidationSeverity.WARNING
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
            // Validate expression syntax for all sequence flows with conditions
            flow.conditionExpression?.textContent?.let { expr ->
                validateExpression(expr, flow.id, "SequenceFlow", flow.name, errors)
            }

            if (flow.source !is ExclusiveGateway) return@forEach
            if ((flow.source as ExclusiveGateway).getOutgoing().size == 1) return@forEach
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
                        reason = "Message intermediate catch event has no process link or message",
                        severity = ValidationSeverity.WARNING
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
                        reason = "Message intermediate throw event has no process link or message",
                        severity = ValidationSeverity.WARNING
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

    private fun validateNoneStartEvents(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(StartEvent::class.java)
            .filter { it.getChildElementsByType(EventDefinition::class.java).isEmpty() }
            .forEach { startEvent ->
                if (processLinkActivityIds.contains(startEvent.id)) return@forEach
                if (startEvent.operatonFormKey != null || startEvent.operatonFormRef != null) return@forEach

                errors.add(
                    ProcessDefinitionValidationError(
                        elementId = startEvent.id,
                        elementType = "StartEvent",
                        elementName = startEvent.name,
                        reason = "None start event has no process link or form",
                        severity = ValidationSeverity.WARNING
                    )
                )
            }
    }

    private fun validateStartEventDefinitions(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(StartEvent::class.java).forEach { startEvent ->
            val eventDefinitions = startEvent.getChildElementsByType(EventDefinition::class.java)
            if (eventDefinitions.isEmpty()) return@forEach

            for (eventDef in eventDefinitions) {
                when (eventDef) {
                    is MessageEventDefinition -> {
                        if (processLinkActivityIds.contains(startEvent.id)) return@forEach
                        if (eventDef.message != null) return@forEach
                        errors.add(
                            ProcessDefinitionValidationError(
                                elementId = startEvent.id,
                                elementType = "MessageStartEvent",
                                elementName = startEvent.name,
                                reason = "Message start event has no process link or message",
                                severity = ValidationSeverity.WARNING
                            )
                        )
                    }
                    is TimerEventDefinition -> {
                        if (eventDef.timeDate != null || eventDef.timeDuration != null || eventDef.timeCycle != null) return@forEach
                        errors.add(
                            ProcessDefinitionValidationError(
                                elementId = startEvent.id,
                                elementType = "TimerStartEvent",
                                elementName = startEvent.name,
                                reason = "Timer start event has no timer configuration"
                            )
                        )
                    }
                    is SignalEventDefinition -> {
                        if (eventDef.signal != null) return@forEach
                        errors.add(
                            ProcessDefinitionValidationError(
                                elementId = startEvent.id,
                                elementType = "SignalStartEvent",
                                elementName = startEvent.name,
                                reason = "Signal start event has no signal reference"
                            )
                        )
                    }
                    is ConditionalEventDefinition -> {
                        if (eventDef.condition != null) return@forEach
                        errors.add(
                            ProcessDefinitionValidationError(
                                elementId = startEvent.id,
                                elementType = "ConditionalStartEvent",
                                elementName = startEvent.name,
                                reason = "Conditional start event has no condition"
                            )
                        )
                    }
                    is ErrorEventDefinition -> {
                        if (eventDef.error != null) return@forEach
                        errors.add(
                            ProcessDefinitionValidationError(
                                elementId = startEvent.id,
                                elementType = "ErrorStartEvent",
                                elementName = startEvent.name,
                                reason = "Error start event has no error reference"
                            )
                        )
                    }
                    is EscalationEventDefinition -> {
                        if (eventDef.escalation != null) return@forEach
                        errors.add(
                            ProcessDefinitionValidationError(
                                elementId = startEvent.id,
                                elementType = "EscalationStartEvent",
                                elementName = startEvent.name,
                                reason = "Escalation start event has no escalation reference"
                            )
                        )
                    }
                }
            }
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

    private fun validateExpression(
        expression: String?,
        elementId: String,
        elementType: String,
        elementName: String?,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        if (expression.isNullOrBlank()) return

        if (!expression.contains("\${") && !expression.contains("#{")) {
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = elementId,
                    elementType = elementType,
                    elementName = elementName,
                    reason = "Expression must use \${...} or #{...} syntax",
                    errorCode = ExpressionValidationErrorCode.MISSING_EL_MARKERS.name,
                    expression = expression
                )
            )
            return
        }

        try {
            treeBuilder.build(expression)
        } catch (e: Exception) {
            val errorCode = mapExceptionToErrorCode(e.message)
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = elementId,
                    elementType = elementType,
                    elementName = elementName,
                    reason = "Invalid expression syntax: ${e.message}",
                    errorCode = errorCode.name,
                    expression = expression
                )
            )
            return
        }

        // Semantic validation - check bean exists
        val processBeans = processBeansSupplier.get()
        if (processBeans.isNotEmpty()) {
            validateExpressionSemantics(processBeans, expression, elementId, elementType, elementName, errors)
        }
    }

    private fun validateExpressionSemantics(
        processBeans: Map<String, Any>,
        expression: String,
        elementId: String,
        elementType: String,
        elementName: String?,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        val beanNameMatch = beanNameRegex.find(expression)
        val beanName = beanNameMatch?.groupValues?.get(1) ?: return

        // Skip JUEL built-ins and common keywords
        if (beanName in listOf("true", "false", "null", "empty", "not")) return

        if (!processBeans.containsKey(beanName)) {
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = elementId,
                    elementType = elementType,
                    elementName = elementName,
                    reason = "Bean '$beanName' not found in process beans",
                    errorCode = ExpressionValidationErrorCode.BEAN_NOT_FOUND.name,
                    expression = expression
                )
            )
        }
    }

    private fun mapExceptionToErrorCode(message: String?): ExpressionValidationErrorCode {
        return when {
            message == null -> ExpressionValidationErrorCode.INVALID_SYNTAX
            message.contains("expected ')'") -> ExpressionValidationErrorCode.UNCLOSED_PARENTHESIS
            message.contains("expected '}'") -> ExpressionValidationErrorCode.UNCLOSED_BRACE
            message.contains("expected ']'") -> ExpressionValidationErrorCode.UNCLOSED_BRACKET
            message.contains("<EOF>") -> ExpressionValidationErrorCode.INCOMPLETE_EXPRESSION
            message.contains("encountered '}'") || message.contains("encountered ')'") ||
                message.contains("encountered ']'") -> ExpressionValidationErrorCode.MISMATCHED_DELIMITER
            else -> ExpressionValidationErrorCode.INVALID_SYNTAX
        }
    }
}
