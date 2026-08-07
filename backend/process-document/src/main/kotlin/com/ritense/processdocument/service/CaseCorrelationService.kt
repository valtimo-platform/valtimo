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

package com.ritense.processdocument.service

import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.runtime.MessageCorrelationResult
import org.operaton.bpm.engine.runtime.ProcessInstance

/**
 * Sends BPMN messages to every process instance that belongs to a case: the case's own processes
 * and every building-block instance of that case.
 *
 * Where [CorrelationService] correlates on a single business key, this service resolves the case a
 * message is meant for and fans the message out over all business keys of that case. This makes
 * building blocks — which run under their own document id as business key — reachable from case
 * processes and vice versa.
 *
 * Available in BPMN as `caseCorrelationService`, e.g.
 * `${caseCorrelationService.sendCatchEventMessageToCase("income-verified", execution)}`.
 */
interface CaseCorrelationService {

    /**
     * Sends [message] to all subscribed process instances of the case the [execution] belongs to.
     *
     * @throws IllegalStateException when the current case cannot be determined from the execution.
     */
    fun sendCatchEventMessageToCase(
        message: String,
        execution: DelegateExecution
    ): List<MessageCorrelationResult>

    /**
     * Sends [message] to all subscribed process instances of the case the [execution] belongs to,
     * with [variables] as alternating name/value pairs.
     */
    fun sendCatchEventMessageToCase(
        message: String,
        execution: DelegateExecution,
        vararg variables: Any?
    ): List<MessageCorrelationResult>

    /**
     * Sends [message] to all subscribed process instances of the case the [execution] belongs to,
     * with [variables] set on the receiving process instances.
     */
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

    /**
     * Sends [message] to all subscribed process instances of the case identified by
     * [caseDocumentId], with [variables] as alternating name/value pairs.
     */
    fun sendCatchEventMessageToCase(
        message: String,
        caseDocumentId: String,
        vararg variables: Any?
    ): List<MessageCorrelationResult>

    /**
     * Sends [message] to all subscribed process instances of the case identified by
     * [caseDocumentId], with [variables] set on the receiving process instances.
     */
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

    /**
     * Starts the matching building blocks of the case the [execution] belongs to, with [variables]
     * as alternating name/value pairs.
     */
    fun sendStartMessageToCase(
        message: String,
        execution: DelegateExecution,
        vararg variables: Any?
    ): List<ProcessInstance>

    /**
     * Starts the matching building blocks of the case the [execution] belongs to, with [variables]
     * set on the started process instances.
     */
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

    /**
     * Starts the matching building blocks of the case identified by [caseDocumentId], with
     * [variables] as alternating name/value pairs.
     */
    fun sendStartMessageToCase(
        message: String,
        caseDocumentId: String,
        vararg variables: Any?
    ): List<ProcessInstance>

    /**
     * Starts the matching building blocks of the case identified by [caseDocumentId], with
     * [variables] set on the started process instances.
     */
    fun sendStartMessageToCase(
        message: String,
        caseDocumentId: String,
        variables: Map<String, Any?>?
    ): List<ProcessInstance>
}
