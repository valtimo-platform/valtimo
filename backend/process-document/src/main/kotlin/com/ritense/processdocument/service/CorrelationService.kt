/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.processdocument.service

import com.ritense.valtimo.contract.annotation.ProcessBean
import com.ritense.valtimo.contract.annotation.ProcessBeanMethod
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.runtime.MessageCorrelationResult
import org.operaton.bpm.engine.runtime.ProcessInstance

@ProcessBean(description = "Sends messages to start or catch events in processes")
interface CorrelationService {

    @ProcessBeanMethod(
        description = "Sends a start message to trigger a message start event",
        example = "\${correlationService.sendStartMessage('start-process', businessKey)}"
    )
    fun sendStartMessage(message: String, businessKey: String): MessageCorrelationResult

    @ProcessBeanMethod(description = "Sends a start message with variables (vararg key-value pairs)")
    fun sendStartMessage(message: String, businessKey: String, vararg variables: Any?): MessageCorrelationResult

    @ProcessBeanMethod(description = "Sends a start message with a variables map")
    fun sendStartMessage(message: String, businessKey: String, variables: Map<String, Any?>?): MessageCorrelationResult

    @ProcessBeanMethod(
        description = "Sends a start message to a specific process definition",
        example = "\${correlationService.sendStartMessageWithProcessDefinitionKey('start-process', 'my-process', businessKey)}"
    )
    fun sendStartMessageWithProcessDefinitionKey(message: String, targetProcessDefinitionKey: String, businessKey: String)

    @ProcessBeanMethod(description = "Sends a start message to a specific process definition with variables")
    fun sendStartMessageWithProcessDefinitionKey(message: String, targetProcessDefinitionKey: String, businessKey: String, vararg variables: Any?)

    @ProcessBeanMethod(description = "Sends a start message to a specific process definition with a variables map")
    fun sendStartMessageWithProcessDefinitionKey(message: String, targetProcessDefinitionKey: String, businessKey: String, variables: Map<String, Any?>?)

    @ProcessBeanMethod(
        description = "Sends a message to a catch event for a specific case",
        example = "\${correlationService.sendCatchEventMessage('approval-received', businessKey)}"
    )
    fun sendCatchEventMessage(message: String, businessKey: String): MessageCorrelationResult

    @ProcessBeanMethod(description = "Sends a message to a catch event with variables")
    fun sendCatchEventMessage(message: String, businessKey: String, vararg variables: Any?): MessageCorrelationResult

    @ProcessBeanMethod(description = "Sends a message to a catch event with a variables map")
    fun sendCatchEventMessage(message: String, businessKey: String, variables: Map<String, Any?>?): MessageCorrelationResult

    @ProcessBeanMethod(
        description = "Sends a global message to any waiting catch event",
        example = "\${correlationService.sendGlobalCatchEventMessage('global-notification')}"
    )
    fun sendGlobalCatchEventMessage(message: String): MessageCorrelationResult

    @ProcessBeanMethod(description = "Sends a global message with variables")
    fun sendGlobalCatchEventMessage(message: String, vararg variables: Any?): MessageCorrelationResult

    @ProcessBeanMethod(description = "Sends a global message with a variables map")
    fun sendGlobalCatchEventMessage(message: String, variables: Map<String, Any?>?): MessageCorrelationResult

    @ProcessBeanMethod(description = "Sends a message to all catch events for a specific case")
    fun sendCatchEventMessageToAll(message: String, businessKey: String): List<MessageCorrelationResult>

    @ProcessBeanMethod(description = "Sends a message to all catch events with variables")
    fun sendCatchEventMessageToAll(message: String, businessKey: String, vararg variables: Any?): List<MessageCorrelationResult>

    @ProcessBeanMethod(description = "Sends a message to all catch events with a variables map")
    fun sendCatchEventMessageToAll(message: String, businessKey: String, variables: Map<String, Any?>?): List<MessageCorrelationResult>

    @ProcessBeanMethod(description = "Sends a global message to all waiting catch events")
    fun sendGlobalCatchEventMessageToAll(message: String): List<MessageCorrelationResult>

    @ProcessBeanMethod(description = "Sends a global message to all with variables")
    fun sendGlobalCatchEventMessageToAll(message: String, vararg variables: Any?): List<MessageCorrelationResult>

    @ProcessBeanMethod(description = "Sends a global message to all with a variables map")
    fun sendGlobalCatchEventMessageToAll(message: String, variables: Map<String, Any?>?): List<MessageCorrelationResult>

    @ProcessBeanMethod(
        description = "Sends a message to a catch event using the current execution's business key",
        example = "\${correlationService.sendMessage('task-completed', execution)}"
    )
    fun sendMessage(message: String, execution: DelegateExecution): MessageCorrelationResult

    @ProcessBeanMethod(description = "Sends a message to all catch events using the current execution's business key")
    fun sendMessageToAll(message: String, execution: DelegateExecution): List<MessageCorrelationResult>

    /**
     * Sends [message] to all subscribed process instances of the case the [execution] belongs to:
     * the case's own processes and every building-block instance of that case, including nested
     * ones. Building blocks run under their own document id as business key, so
     * [sendCatchEventMessageToAll] with the case business key does not reach them.
     *
     * @throws IllegalStateException when the current case cannot be determined from the execution.
     */
    fun sendCatchEventMessageToCase(
        message: String,
        execution: DelegateExecution
    ): List<MessageCorrelationResult>

    fun sendCatchEventMessageToCase(
        message: String,
        execution: DelegateExecution,
        vararg variables: Any?
    ): List<MessageCorrelationResult>

    fun sendCatchEventMessageToCase(
        message: String,
        execution: DelegateExecution,
        variables: Map<String, Any?>?
    ): List<MessageCorrelationResult>

    /**
     * Sends [message] to all subscribed process instances of the case identified by
     * [caseDocumentId], for example a related case. A building-block document id is accepted too
     * and is normalized to the case it belongs to.
     *
     * @throws IllegalArgumentException when [caseDocumentId] is not a valid document id.
     */
    fun sendCatchEventMessageToCase(
        message: String,
        caseDocumentId: String
    ): List<MessageCorrelationResult>

    fun sendCatchEventMessageToCase(
        message: String,
        caseDocumentId: String,
        vararg variables: Any?
    ): List<MessageCorrelationResult>

    fun sendCatchEventMessageToCase(
        message: String,
        caseDocumentId: String,
        variables: Map<String, Any?>?
    ): List<MessageCorrelationResult>

    /**
     * Starts a new instance of every building block that is linked to the case the [execution]
     * belongs to and whose main process declares a message start event named [message]. The
     * building block is started in the version the case link pins, not the latest deployed one.
     *
     * The returned process instances carry the case business key as it was at start time; the
     * building-block bootstrap rewrites it to the new building-block document id within the same
     * transaction.
     *
     * @throws IllegalStateException when the current case cannot be determined from the execution.
     */
    fun sendStartMessageToCase(
        message: String,
        execution: DelegateExecution
    ): List<ProcessInstance>

    fun sendStartMessageToCase(
        message: String,
        execution: DelegateExecution,
        vararg variables: Any?
    ): List<ProcessInstance>

    fun sendStartMessageToCase(
        message: String,
        execution: DelegateExecution,
        variables: Map<String, Any?>?
    ): List<ProcessInstance>

    /**
     * Starts the matching building blocks of the case identified by [caseDocumentId], for example a
     * related case. A building-block document id is accepted too and is normalized to the case it
     * belongs to.
     *
     * @throws IllegalArgumentException when [caseDocumentId] is not a valid document id.
     */
    fun sendStartMessageToCase(
        message: String,
        caseDocumentId: String
    ): List<ProcessInstance>

    fun sendStartMessageToCase(
        message: String,
        caseDocumentId: String,
        vararg variables: Any?
    ): List<ProcessInstance>

    fun sendStartMessageToCase(
        message: String,
        caseDocumentId: String,
        variables: Map<String, Any?>?
    ): List<ProcessInstance>
}