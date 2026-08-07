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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.processdocument.helper.GetJsonSchemaDocumentHelper.getJsonSchemaDocumentIdOrNull
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import io.github.oshai.kotlinlogging.KotlinLogging
import java.util.UUID
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.runtime.MessageCorrelationResult
import org.operaton.bpm.engine.runtime.ProcessInstance

class CaseCorrelationServiceImpl(
    private val runtimeService: RuntimeService,
    private val correlationService: CorrelationService,
    private val caseDocumentResolver: CaseDocumentResolver,
    private val businessKeyProviders: List<CaseCorrelationBusinessKeyProvider>,
    private val startTargetProviders: List<CaseCorrelationStartTargetProvider>,
) : CaseCorrelationService {

    override fun sendCatchEventMessageToCase(
        message: String,
        execution: DelegateExecution
    ): List<MessageCorrelationResult> {
        return sendCatchEventMessageToCase(message, execution, null as Map<String, Any?>?)
    }

    override fun sendCatchEventMessageToCase(
        message: String,
        execution: DelegateExecution,
        vararg variables: Any?
    ): List<MessageCorrelationResult> {
        return sendCatchEventMessageToCase(message, execution, toVariableMap(*variables))
    }

    override fun sendCatchEventMessageToCase(
        message: String,
        execution: DelegateExecution,
        variables: Map<String, Any?>?
    ): List<MessageCorrelationResult> {
        return sendCatchEventMessageToCase(message, resolveCaseDocumentId(execution), variables)
    }

    override fun sendCatchEventMessageToCase(
        message: String,
        caseDocumentId: String
    ): List<MessageCorrelationResult> {
        return sendCatchEventMessageToCase(message, caseDocumentId, null as Map<String, Any?>?)
    }

    override fun sendCatchEventMessageToCase(
        message: String,
        caseDocumentId: String,
        vararg variables: Any?
    ): List<MessageCorrelationResult> {
        return sendCatchEventMessageToCase(message, caseDocumentId, toVariableMap(*variables))
    }

    override fun sendCatchEventMessageToCase(
        message: String,
        caseDocumentId: String,
        variables: Map<String, Any?>?
    ): List<MessageCorrelationResult> {
        return sendCatchEventMessageToCase(message, resolveCaseDocumentId(caseDocumentId), variables)
    }

    private fun sendCatchEventMessageToCase(
        message: String,
        caseDocumentId: UUID,
        variables: Map<String, Any?>?
    ): List<MessageCorrelationResult> {
        val caseBusinessKey = caseDocumentId.toString()

        // Delivery to the case's own processes keeps the behaviour of CorrelationService, including
        // the ProcessDocumentInstance association.
        val caseResults = correlationService.sendCatchEventMessageToAll(message, caseBusinessKey, variables)

        // Building blocks run under their own document id as business key. They get the message too,
        // but deliberately without a case association: their processes belong to the BB document.
        val additionalResults = businessKeyProviders
            .flatMap { it.getBusinessKeysForCase(caseDocumentId) }
            .distinct()
            .filterNot { it == caseBusinessKey }
            .flatMap { correlateAll(message, it, variables) }

        val results = caseResults + additionalResults
        if (results.isEmpty()) {
            logger.warn {
                "No process instance of case '$caseBusinessKey' was subscribed to message '$message'."
            }
        }
        return results
    }

    override fun sendStartMessageToCase(
        message: String,
        execution: DelegateExecution
    ): List<ProcessInstance> {
        return sendStartMessageToCase(message, execution, null as Map<String, Any?>?)
    }

    override fun sendStartMessageToCase(
        message: String,
        execution: DelegateExecution,
        vararg variables: Any?
    ): List<ProcessInstance> {
        return sendStartMessageToCase(message, execution, toVariableMap(*variables))
    }

    override fun sendStartMessageToCase(
        message: String,
        execution: DelegateExecution,
        variables: Map<String, Any?>?
    ): List<ProcessInstance> {
        return sendStartMessageToCase(message, resolveCaseDocumentId(execution), variables)
    }

    override fun sendStartMessageToCase(
        message: String,
        caseDocumentId: String
    ): List<ProcessInstance> {
        return sendStartMessageToCase(message, caseDocumentId, null as Map<String, Any?>?)
    }

    override fun sendStartMessageToCase(
        message: String,
        caseDocumentId: String,
        vararg variables: Any?
    ): List<ProcessInstance> {
        return sendStartMessageToCase(message, caseDocumentId, toVariableMap(*variables))
    }

    override fun sendStartMessageToCase(
        message: String,
        caseDocumentId: String,
        variables: Map<String, Any?>?
    ): List<ProcessInstance> {
        return sendStartMessageToCase(message, resolveCaseDocumentId(caseDocumentId), variables)
    }

    private fun sendStartMessageToCase(
        message: String,
        caseDocumentId: UUID,
        variables: Map<String, Any?>?
    ): List<ProcessInstance> {
        val processInstances = startTargetProviders
            .flatMap { it.getStartTargets(caseDocumentId, message) }
            .distinct()
            .map { correlateStartMessage(message, caseDocumentId.toString(), it, variables) }

        if (processInstances.isEmpty()) {
            logger.warn {
                "No process definition linked to case '$caseDocumentId' declares a start event " +
                    "for message '$message'."
            }
        }
        return processInstances
    }

    private fun resolveCaseDocumentId(execution: DelegateExecution): UUID {
        val documentId = execution.getJsonSchemaDocumentIdOrNull()
            ?: throw IllegalStateException(
                "Cannot determine the current case for process instance '${execution.processInstanceId}': " +
                    "the business key is not a document id. " +
                    "Use the overload that accepts an explicit case document id."
            )
        return resolveCaseDocumentId(documentId)
    }

    private fun resolveCaseDocumentId(caseDocumentId: String): UUID {
        val documentId = try {
            UUID.fromString(caseDocumentId)
        } catch (e: IllegalArgumentException) {
            throw IllegalArgumentException(
                "Cannot send a message to case '$caseDocumentId': the value is not a valid document id.", e
            )
        }
        return resolveCaseDocumentId(documentId)
    }

    /**
     * Resolving the owning case is an internal step of message delivery, so it runs in system
     * context — like the document lookups in [CorrelationServiceImpl]. Message correlation itself
     * is not permission-checked either, and expressions are also evaluated from async jobs and
     * timers, which carry no user context.
     */
    private fun resolveCaseDocumentId(documentId: UUID): UUID {
        return runWithoutAuthorization { caseDocumentResolver.resolveCaseDocumentId(documentId) }
    }

    private fun correlateAll(
        message: String,
        businessKey: String,
        variables: Map<String, Any?>?
    ): List<MessageCorrelationResult> {
        val builder = runtimeService.createMessageCorrelation(message)
        builder.processInstanceBusinessKey(businessKey)
        variables?.run { builder.setVariables(variables) }
        return builder.correlateAllWithResult()
    }

    private fun correlateStartMessage(
        message: String,
        businessKey: String,
        processDefinitionId: String,
        variables: Map<String, Any?>?
    ): ProcessInstance {
        val builder = runtimeService.createMessageCorrelation(message)
        builder.processDefinitionId(processDefinitionId)
        builder.processInstanceBusinessKey(businessKey)
        variables?.run { builder.setVariables(variables) }
        return builder.correlateStartMessage()
    }

    private fun toVariableMap(vararg variables: Any?): Map<String, Any?>? {
        return if (variables.isNotEmpty()) {
            (0 until variables.size / 2).associate { i -> variables[i * 2] as String to variables[i * 2 + 1] }
        } else {
            null
        }
    }

    private companion object {
        private val logger = KotlinLogging.logger {}
    }
}
