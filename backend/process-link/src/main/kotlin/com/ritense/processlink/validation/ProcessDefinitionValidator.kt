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

package com.ritense.processlink.validation

import com.ritense.processlink.service.BpmnInvisibleOrphanCleaner
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.valtimo.processbean.ProcessBeanService
import org.operaton.bpm.impl.juel.Builder
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.BoundaryEvent
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
import org.operaton.bpm.model.bpmn.instance.SubProcess
import org.operaton.bpm.model.bpmn.instance.TerminateEventDefinition
import org.operaton.bpm.model.bpmn.instance.TimerEventDefinition
import org.operaton.bpm.model.bpmn.instance.UserTask
import org.operaton.bpm.model.bpmn.instance.operaton.OperatonExecutionListener
import org.operaton.bpm.model.bpmn.instance.operaton.OperatonTaskListener
import java.util.function.Supplier

data class ProcessDefinitionValidationOptions(
    val canInitializeDocument: Boolean = true,
    val startableByUser: Boolean = true
)

class ProcessDefinitionValidator(
    private val processBeansSupplier: Supplier<Map<String, Any>> = Supplier { emptyMap() },
    private val processBeanService: ProcessBeanService? = null,
    private val bpmnInvisibleOrphanCleaner: BpmnInvisibleOrphanCleaner = BpmnInvisibleOrphanCleaner()
) {
    private val treeBuilder = Builder(Builder.Feature.METHOD_INVOCATIONS)
    private val beanNameRegex = Regex("""[\$#]\{(\w+)[\.\(\}]""")
    private val methodCallRegex = Regex("""[\$#]\{(\w+)\.(\w+)\(([^)]*)\)?""")

    fun validate(
        bpmnModel: BpmnModelInstance,
        processLinks: List<ProcessLinkCreateRequestDto>,
        options: ProcessDefinitionValidationOptions = ProcessDefinitionValidationOptions()
    ): ProcessDefinitionValidationResult {
        bpmnInvisibleOrphanCleaner.clean(bpmnModel)

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
        validateNoneStartEvents(bpmnModel, processLinkActivityIds, options, errors)
        validateListenerExpressions(bpmnModel, errors)

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
                    reason = "Process has no start event",
                    errorCode = ProcessDefinitionValidationErrorCode.NO_START_EVENT.name
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
                    reason = "Process has no end event",
                    errorCode = ProcessDefinitionValidationErrorCode.NO_END_EVENT.name
                )
            )
        }
    }

    private fun validateFlowNodeConnections(
        process: Process,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        val boundaryEvents = process.getChildElementsByType(BoundaryEvent::class.java)
        val activitiesWithBoundaryEvents = boundaryEvents.mapNotNull { it.attachedTo?.id }.toSet()

        process.getChildElementsByType(FlowNode::class.java).forEach { node ->
            if (node is StartEvent) {
                if (node.getOutgoing().isEmpty()) {
                    errors.add(
                        ProcessDefinitionValidationError(
                            elementId = node.id,
                            elementType = node.elementType.typeName,
                            elementName = node.name,
                            reason = "Start event has no outgoing flow",
                            errorCode = ProcessDefinitionValidationErrorCode.NO_OUTGOING_FLOW.name
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
                            reason = "End event has no incoming flow",
                            errorCode = ProcessDefinitionValidationErrorCode.NO_INCOMING_FLOW.name
                        )
                    )
                }
            } else if (node is BoundaryEvent) {
                // Boundary events attach to activities, so they don't need incoming flows
                if (node.getOutgoing().isEmpty()) {
                    errors.add(
                        ProcessDefinitionValidationError(
                            elementId = node.id,
                            elementType = node.elementType.typeName,
                            elementName = node.name,
                            reason = "Boundary event has no outgoing flow",
                            errorCode = ProcessDefinitionValidationErrorCode.NO_OUTGOING_FLOW.name
                        )
                    )
                }
            } else if (node is SubProcess && node.triggeredByEvent()) {
                // Event sub-processes are triggered by events, not sequence flows
                return@forEach
            } else {
                if (node.getIncoming().isEmpty()) {
                    errors.add(
                        ProcessDefinitionValidationError(
                            elementId = node.id,
                            elementType = node.elementType.typeName,
                            elementName = node.name,
                            reason = "Element has no incoming flow",
                            errorCode = ProcessDefinitionValidationErrorCode.NO_INCOMING_FLOW.name
                        )
                    )
                }
                // Activities with boundary events don't need outgoing flows
                if (node.getOutgoing().isEmpty() && node.id !in activitiesWithBoundaryEvents) {
                    errors.add(
                        ProcessDefinitionValidationError(
                            elementId = node.id,
                            elementType = node.elementType.typeName,
                            elementName = node.name,
                            reason = "Element has no outgoing flow",
                            errorCode = ProcessDefinitionValidationErrorCode.NO_OUTGOING_FLOW.name
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
        val boundaryEventsByActivity = process.getChildElementsByType(BoundaryEvent::class.java)
            .groupBy { it.attachedTo?.id }

        val visited = mutableSetOf<String>()
        val queue = ArrayDeque<FlowNode>()

        startEvents.forEach { queue.add(it) }

        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            if (!visited.add(current.id)) continue
            getSuccessors(current, boundaryEventsByActivity).forEach { successor ->
                if (!visited.contains(successor.id)) {
                    queue.add(successor)
                }
            }
        }

        allFlowNodes.forEach { node ->
            // Event sub-processes are triggered by events, not sequence flows
            if (node is SubProcess && node.triggeredByEvent()) return@forEach

            if (!visited.contains(node.id)) {
                errors.add(
                    ProcessDefinitionValidationError(
                        elementId = node.id,
                        elementType = node.elementType.typeName,
                        elementName = node.name,
                        reason = "Element is not reachable from any start event",
                        errorCode = ProcessDefinitionValidationErrorCode.UNREACHABLE_ELEMENT.name,
                        severity = ValidationSeverity.WARNING
                    )
                )
            }
        }
    }

    private fun getSuccessors(
        node: FlowNode,
        boundaryEventsByActivity: Map<String?, List<BoundaryEvent>>
    ): List<FlowNode> {
        val successors = mutableListOf<FlowNode>()
        // Regular outgoing sequence flows
        node.getOutgoing().forEach { successors.add(it.target) }
        // Boundary events attached to this activity
        boundaryEventsByActivity[node.id]?.forEach { successors.add(it) }
        return successors
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
                    errorCode = ProcessDefinitionValidationErrorCode.MULTIPLE_NONE_START_EVENTS.name
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

        val boundaryEventsByActivity = process.getChildElementsByType(BoundaryEvent::class.java)
            .groupBy { it.attachedTo?.id }

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
                getSuccessors(current, boundaryEventsByActivity).forEach { successor ->
                    if (!visited.contains(successor.id)) {
                        queue.add(successor)
                    }
                }
            }

            if (!reachesEndEvent) {
                errors.add(
                    ProcessDefinitionValidationError(
                        elementId = startEvent.id,
                        elementType = startEvent.elementType.typeName,
                        elementName = startEvent.name,
                        reason = "Start event has no path to an end event",
                        errorCode = ProcessDefinitionValidationErrorCode.NO_PATH_TO_END_EVENT.name
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
                    errorCode = ProcessDefinitionValidationErrorCode.SERVICE_TASK_NO_IMPLEMENTATION.name,
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
                    errorCode = ProcessDefinitionValidationErrorCode.USER_TASK_NO_FORM.name,
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
                    errorCode = ProcessDefinitionValidationErrorCode.SEND_TASK_NO_IMPLEMENTATION.name,
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
                    errorCode = ProcessDefinitionValidationErrorCode.RECEIVE_TASK_NO_MESSAGE.name,
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
                    errorCode = ProcessDefinitionValidationErrorCode.BUSINESS_RULE_TASK_NO_IMPLEMENTATION.name,
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
                    errorCode = ProcessDefinitionValidationErrorCode.CALL_ACTIVITY_NO_CALLED_ELEMENT.name,
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
                    reason = "Sequence flow from exclusive gateway has no condition",
                    errorCode = ProcessDefinitionValidationErrorCode.SEQUENCE_FLOW_NO_CONDITION.name
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
                        errorCode = ProcessDefinitionValidationErrorCode.MESSAGE_EVENT_NO_MESSAGE.name,
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
                        errorCode = ProcessDefinitionValidationErrorCode.MESSAGE_EVENT_NO_MESSAGE.name,
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
                        reason = "Timer intermediate catch event has no timer configuration",
                        errorCode = ProcessDefinitionValidationErrorCode.TIMER_EVENT_NO_CONFIG.name
                    )
                )
            }
    }

    private fun validateNoneStartEvents(
        bpmnModel: BpmnModelInstance,
        processLinkActivityIds: Set<String>,
        options: ProcessDefinitionValidationOptions,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        if (!options.canInitializeDocument && !options.startableByUser) {
            return
        }

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
                        errorCode = ProcessDefinitionValidationErrorCode.START_EVENT_NO_FORM.name,
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
                                errorCode = ProcessDefinitionValidationErrorCode.MESSAGE_EVENT_NO_MESSAGE.name,
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
                                reason = "Timer start event has no timer configuration",
                                errorCode = ProcessDefinitionValidationErrorCode.TIMER_EVENT_NO_CONFIG.name
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
                                reason = "Signal start event has no signal reference",
                                errorCode = ProcessDefinitionValidationErrorCode.SIGNAL_EVENT_NO_SIGNAL.name
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
                                reason = "Conditional start event has no condition",
                                errorCode = ProcessDefinitionValidationErrorCode.CONDITIONAL_EVENT_NO_CONDITION.name
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
                                reason = "Error start event has no error reference",
                                errorCode = ProcessDefinitionValidationErrorCode.ERROR_EVENT_NO_ERROR.name
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
                                reason = "Escalation start event has no escalation reference",
                                errorCode = ProcessDefinitionValidationErrorCode.ESCALATION_EVENT_NO_ESCALATION.name
                            )
                        )
                    }
                }
            }
        }
    }

    private fun validateListenerExpressions(
        bpmnModel: BpmnModelInstance,
        errors: MutableList<ProcessDefinitionValidationError>
    ) {
        bpmnModel.getModelElementsByType(FlowNode::class.java).forEach { element ->
            val extensionElements = element.extensionElements ?: return@forEach

            extensionElements.elementsQuery
                .filterByType(OperatonExecutionListener::class.java)
                .list()
                .forEachIndexed { index, listener ->
                    validateExpression(
                        listener.operatonExpression,
                        element.id,
                        element.elementType.typeName,
                        element.name,
                        errors,
                        "executionListener",
                        index
                    )
                    validateExpression(
                        listener.operatonDelegateExpression,
                        element.id,
                        element.elementType.typeName,
                        element.name,
                        errors,
                        "executionListener",
                        index
                    )
                }

            extensionElements.elementsQuery
                .filterByType(OperatonTaskListener::class.java)
                .list()
                .forEachIndexed { index, listener ->
                    validateExpression(
                        listener.operatonExpression,
                        element.id,
                        element.elementType.typeName,
                        element.name,
                        errors,
                        "taskListener",
                        index
                    )
                    validateExpression(
                        listener.operatonDelegateExpression,
                        element.id,
                        element.elementType.typeName,
                        element.name,
                        errors,
                        "taskListener",
                        index
                    )
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
        errors: MutableList<ProcessDefinitionValidationError>,
        listenerType: String? = null,
        listenerIndex: Int? = null
    ) {
        if (expression.isNullOrBlank()) return

        if (!expression.contains("\${") && !expression.contains("#{")) {
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = elementId,
                    elementType = elementType,
                    elementName = elementName,
                    reason = "Expression must use \${...} or #{...} syntax",
                    errorCode = ProcessDefinitionValidationErrorCode.EXPRESSION_MISSING_EL_MARKERS.name,
                    expression = expression,
                    listenerType = listenerType,
                    listenerIndex = listenerIndex
                )
            )
            return
        }

        var syntaxError: Exception? = null
        try {
            treeBuilder.build(expression)
        } catch (e: Exception) {
            syntaxError = e
        }

        // Try semantic validation - it may give a more helpful error or confirm the expression is valid
        val processBeans = processBeansSupplier.get()
        val methodValidationRan = if (processBeans.isNotEmpty()) {
            validateExpressionSemantics(processBeans, expression, elementId, elementType, elementName, errors, listenerType, listenerIndex)
        } else {
            false
        }

        // Only report syntax error if method validation didn't run (can't confirm method is valid)
        if (syntaxError != null && !methodValidationRan) {
            val errorCode = mapExceptionToExpressionErrorCode(syntaxError.message)
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = elementId,
                    elementType = elementType,
                    elementName = elementName,
                    reason = "Invalid expression syntax: ${syntaxError.message}",
                    errorCode = errorCode.name,
                    expression = expression,
                    listenerType = listenerType,
                    listenerIndex = listenerIndex
                )
            )
        }
    }

    private fun validateExpressionSemantics(
        processBeans: Map<String, Any>,
        expression: String,
        elementId: String,
        elementType: String,
        elementName: String?,
        errors: MutableList<ProcessDefinitionValidationError>,
        listenerType: String? = null,
        listenerIndex: Int? = null
    ): Boolean {
        val beanNameMatch = beanNameRegex.find(expression)
        val beanName = beanNameMatch?.groupValues?.get(1) ?: return false

        // Skip JUEL built-ins and Operaton runtime variables
        val alwaysAvailable = setOf("true", "false", "null", "empty", "not",
            "execution", "authenticatedUserId", "variableContext")
        if (beanName in alwaysAvailable) return false
        if (elementType == "UserTask" && beanName == "task") return false

        if (!processBeans.containsKey(beanName)) {
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = elementId,
                    elementType = elementType,
                    elementName = elementName,
                    reason = "No bean named '$beanName' found. If using a process variable, ensure it exists at runtime.",
                    errorCode = ProcessDefinitionValidationErrorCode.EXPRESSION_BEAN_NOT_FOUND.name,
                    expression = expression,
                    severity = ValidationSeverity.WARNING,
                    listenerType = listenerType,
                    listenerIndex = listenerIndex
                )
            )
            return false
        }

        // Validate method existence and argument count if ProcessBeanService is available
        if (processBeanService != null) {
            return validateMethodCall(processBeanService, beanName, expression, elementId, elementType, elementName, errors, listenerType, listenerIndex)
        }
        return false
    }

    private fun validateMethodCall(
        processBeanService: ProcessBeanService,
        beanName: String,
        expression: String,
        elementId: String,
        elementType: String,
        elementName: String?,
        errors: MutableList<ProcessDefinitionValidationError>,
        listenerType: String? = null,
        listenerIndex: Int? = null
    ): Boolean {
        val methodMatch = methodCallRegex.find(expression) ?: return false
        val methodName = methodMatch.groupValues[2]
        val argsString = methodMatch.groupValues[3].trim()

        val beanDto = processBeanService.getProcessBean(beanName) ?: return false

        val matchingMethods = beanDto.methods.filter { it.name == methodName }

        if (matchingMethods.isEmpty()) {
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = elementId,
                    elementType = elementType,
                    elementName = elementName,
                    reason = "Method '$methodName' not found on bean '$beanName'.",
                    errorCode = ProcessDefinitionValidationErrorCode.EXPRESSION_METHOD_NOT_FOUND.name,
                    expression = expression,
                    severity = ValidationSeverity.WARNING,
                    invalidFields = listOf("operaton:expression", "operaton:delegateExpression"),
                    listenerType = listenerType,
                    listenerIndex = listenerIndex
                )
            )
            return true
        }

        val (actualArgCount, emptyArgIndices) = countArgumentsWithEmptyCheck(argsString)
        val matchingOverload = matchingMethods.find { it.parameters.size == actualArgCount }

        if (matchingOverload == null) {
            val minExpected = matchingMethods.minOf { it.parameters.size }
            if (actualArgCount < minExpected) {
                val targetOverload = matchingMethods.minByOrNull { it.parameters.size }!!
                val missingIndices = (actualArgCount until targetOverload.parameters.size).toList()
                val allEmptyIndices = (emptyArgIndices + missingIndices).distinct().sorted()
                val emptyNames = allEmptyIndices.map { targetOverload.parameters[it].name }
                val emptyText = if (allEmptyIndices.size == targetOverload.parameters.size) {
                    "All arguments are empty"
                } else {
                    "Empty argument(s): ${emptyNames.joinToString(", ")}"
                }
                errors.add(
                    ProcessDefinitionValidationError(
                        elementId = elementId,
                        elementType = elementType,
                        elementName = elementName,
                        reason = "$emptyText for method '$methodName' on bean '$beanName'.",
                        errorCode = ProcessDefinitionValidationErrorCode.EXPRESSION_EMPTY_ARGUMENTS.name,
                        expression = expression,
                        severity = ValidationSeverity.ERROR,
                        invalidFields = listOf("operaton:expression", "operaton:delegateExpression"),
                        invalidArguments = allEmptyIndices,
                        listenerType = listenerType,
                        listenerIndex = listenerIndex
                    )
                )
            } else {
                val expectedCounts = matchingMethods.map { it.parameters.size }.distinct().sorted()
                val expectedText = if (expectedCounts.size == 1) {
                    "${expectedCounts[0]}"
                } else {
                    expectedCounts.joinToString(" or ")
                }
                errors.add(
                    ProcessDefinitionValidationError(
                        elementId = elementId,
                        elementType = elementType,
                        elementName = elementName,
                        reason = "Method '$methodName' on bean '$beanName' expects $expectedText argument(s) but got $actualArgCount.",
                        errorCode = ProcessDefinitionValidationErrorCode.EXPRESSION_ARGUMENT_COUNT_MISMATCH.name,
                        expression = expression,
                        severity = ValidationSeverity.ERROR,
                        invalidFields = listOf("operaton:expression", "operaton:delegateExpression"),
                        listenerType = listenerType,
                        listenerIndex = listenerIndex
                    )
                )
            }
        } else if (emptyArgIndices.isNotEmpty()) {
            val params = matchingOverload.parameters
            val emptyParamNames = emptyArgIndices.map { idx ->
                if (idx < params.size) params[idx].name else "argument ${idx + 1}"
            }
            val emptyText = if (emptyParamNames.size == actualArgCount) {
                "All arguments are empty"
            } else {
                "Empty argument(s): ${emptyParamNames.joinToString(", ")}"
            }
            errors.add(
                ProcessDefinitionValidationError(
                    elementId = elementId,
                    elementType = elementType,
                    elementName = elementName,
                    reason = "$emptyText for method '$methodName' on bean '$beanName'.",
                    errorCode = ProcessDefinitionValidationErrorCode.EXPRESSION_EMPTY_ARGUMENTS.name,
                    expression = expression,
                    severity = ValidationSeverity.ERROR,
                    invalidFields = listOf("operaton:expression", "operaton:delegateExpression"),
                    invalidArguments = emptyArgIndices,
                    listenerType = listenerType,
                    listenerIndex = listenerIndex
                )
            )
        }
        // Return true to indicate method validation ran (suppress generic syntax error)
        return true
    }

    private fun countArgumentsWithEmptyCheck(argsString: String): Pair<Int, List<Int>> {
        if (argsString.isEmpty()) return Pair(0, emptyList())

        val arguments = mutableListOf<String>()
        var currentArg = StringBuilder()
        var depth = 0
        var inString = false
        var stringChar = ' '

        for (char in argsString) {
            when {
                !inString && (char == '"' || char == '\'') -> {
                    inString = true
                    stringChar = char
                    currentArg.append(char)
                }
                inString && char == stringChar -> {
                    inString = false
                    currentArg.append(char)
                }
                !inString && char == '(' -> {
                    depth++
                    currentArg.append(char)
                }
                !inString && char == ')' -> {
                    depth--
                    currentArg.append(char)
                }
                !inString && char == ',' && depth == 0 -> {
                    arguments.add(currentArg.toString())
                    currentArg = StringBuilder()
                }
                else -> currentArg.append(char)
            }
        }
        arguments.add(currentArg.toString())

        val emptyIndices = arguments.mapIndexedNotNull { index, arg ->
            if (arg.trim().isEmpty()) index else null
        }

        return Pair(arguments.size, emptyIndices)
    }

    private fun mapExceptionToExpressionErrorCode(message: String?): ProcessDefinitionValidationErrorCode {
        return when {
            message == null -> ProcessDefinitionValidationErrorCode.EXPRESSION_INVALID_SYNTAX
            message.contains("expected ')'") -> ProcessDefinitionValidationErrorCode.EXPRESSION_UNCLOSED_PARENTHESIS
            message.contains("expected '}'") -> ProcessDefinitionValidationErrorCode.EXPRESSION_UNCLOSED_BRACE
            message.contains("expected ']'") -> ProcessDefinitionValidationErrorCode.EXPRESSION_UNCLOSED_BRACKET
            message.contains("<EOF>") -> ProcessDefinitionValidationErrorCode.EXPRESSION_INCOMPLETE
            message.contains("encountered '}'") || message.contains("encountered ')'") ||
                message.contains("encountered ']'") -> ProcessDefinitionValidationErrorCode.EXPRESSION_MISMATCHED_DELIMITER
            else -> ProcessDefinitionValidationErrorCode.EXPRESSION_INVALID_SYNTAX
        }
    }
}
