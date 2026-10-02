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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.helper.GetJsonSchemaDocumentHelper.getJsonSchemaDocumentIdOrNull
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byKey
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byLatestVersion
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.operaton.service.OperatonRuntimeService
import io.github.oshai.kotlinlogging.KotlinLogging
import java.util.UUID
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.operaton.bpm.engine.runtime.MessageCorrelationResult
import org.operaton.bpm.engine.runtime.ProcessInstance

class CorrelationServiceImpl(
    val runtimeService: RuntimeService,
    val operatonRuntimeService: OperatonRuntimeService,
    val documentService: DocumentService,
    val operatonRepositoryService: OperatonRepositoryService,
    val repositoryService: RepositoryService,
    val associationService: ProcessDocumentAssociationService,
    val caseDocumentResolver: CaseDocumentResolver,
    val businessKeyProviders: List<CaseCorrelationBusinessKeyProvider> = emptyList(),
    val startTargetProviders: List<CaseCorrelationStartTargetProvider> = emptyList(),
) : CorrelationService {

    override fun sendStartMessage(message: String, businessKey: String): MessageCorrelationResult {
        return sendStartMessage(message, businessKey, null)
    }

    override fun sendStartMessage(
        message: String,
        businessKey: String,
        vararg variables: Any?
    ): MessageCorrelationResult {
        return sendStartMessage(message, businessKey, toVariableMap(*variables))
    }

    override fun sendStartMessage(
        message: String,
        businessKey: String,
        variables: Map<String, Any?>?
    ): MessageCorrelationResult {
        val result = correlate(message, businessKey, variables)
        val processName = getProcessDefinitionName(result.processInstance.processDefinitionId)
        associateDocumentToProcess(result.processInstance.id, processName, businessKey)
        return result
    }

    override fun sendStartMessageWithProcessDefinitionKey(
        message: String,
        targetProcessDefinitionKey: String,
        businessKey: String
    ) {
        sendStartMessageWithProcessDefinitionKey(message, targetProcessDefinitionKey, businessKey, null)
    }

    override fun sendStartMessageWithProcessDefinitionKey(
        message: String,
        targetProcessDefinitionKey: String,
        businessKey: String,
        variables: Map<String, Any?>?
    ) {
        val processDefinitionId = getLatestProcessDefinitionIdByKey(targetProcessDefinitionKey)
        val result = correlateWithProcessDefinitionId(message, businessKey, processDefinitionId.id, variables)
        val processName = getProcessDefinitionName(result.processDefinitionId)
        associateDocumentToProcess(result.processInstanceId, processName, businessKey)
    }

    override fun sendStartMessageWithProcessDefinitionKey(
        message: String,
        targetProcessDefinitionKey: String,
        businessKey: String,
        vararg variables: Any?
    ) {
        sendStartMessageWithProcessDefinitionKey(
            message,
            targetProcessDefinitionKey,
            businessKey,
            toVariableMap(*variables)
        )
    }

    override fun sendCatchEventMessage(message: String, businessKey: String): MessageCorrelationResult {
        return sendCatchEventMessage(message, businessKey, null)
    }

    override fun sendCatchEventMessage(
        message: String,
        businessKey: String,
        variables: Map<String, Any?>?
    ): MessageCorrelationResult {
        val result = correlate(message, businessKey, variables)
        val processInstanceId = result.execution.processInstanceId
        val processName = getProcessDefinitionNameByProcessInstanceId(processInstanceId)
        associateDocumentToProcess(processInstanceId, processName, businessKey)
        return result
    }

    override fun sendCatchEventMessage(
        message: String,
        businessKey: String,
        vararg variables: Any?
    ): MessageCorrelationResult {
        return sendCatchEventMessage(message, businessKey, toVariableMap(*variables))
    }

    override fun sendGlobalCatchEventMessage(message: String): MessageCorrelationResult {
        return sendGlobalCatchEventMessage(message, null)
    }

    override fun sendGlobalCatchEventMessage(
        message: String,
        variables: Map<String, Any?>?
    ): MessageCorrelationResult {
        return correlate(message, null, variables)
    }

    override fun sendGlobalCatchEventMessage(
        message: String,
        vararg variables: Any?
    ): MessageCorrelationResult {
        return sendGlobalCatchEventMessage(message, toVariableMap(*variables))
    }

    override fun sendCatchEventMessageToAll(message: String, businessKey: String): List<MessageCorrelationResult> {
        return sendCatchEventMessageToAll(message, businessKey, null)
    }

    override fun sendCatchEventMessageToAll(
        message: String,
        businessKey: String,
        variables: Map<String, Any?>?
    ): List<MessageCorrelationResult> {
        val correlationResultProcessList = correlateAll(message, businessKey, variables)
        correlationResultProcessList.forEach { correlationResultProcess ->
            val processInstanceId = correlationResultProcess.execution.processInstanceId
            val processName = getProcessDefinitionNameByProcessInstanceId(processInstanceId)
            associateDocumentToProcess(processInstanceId, processName, businessKey)
        }

        return correlationResultProcessList
    }

    override fun sendCatchEventMessageToAll(
        message: String,
        businessKey: String,
        vararg variables: Any?
    ): List<MessageCorrelationResult> {
        return sendCatchEventMessageToAll(message, businessKey, toVariableMap(*variables))
    }

    override fun sendGlobalCatchEventMessageToAll(message: String): List<MessageCorrelationResult> {
        return sendGlobalCatchEventMessageToAll(message, null)
    }

    override fun sendGlobalCatchEventMessageToAll(
        message: String,
        variables: Map<String, Any?>?
    ): List<MessageCorrelationResult> {
        return correlateAll(message, null, variables)
    }

    override fun sendGlobalCatchEventMessageToAll(
        message: String,
        vararg variables: Any?
    ): List<MessageCorrelationResult> {
        return sendGlobalCatchEventMessageToAll(message, toVariableMap(*variables))
    }

    override fun sendMessage(message: String, execution: DelegateExecution): MessageCorrelationResult {
        val result = correlate(message, execution.businessKey, execution.variables)
        associateDocumentToProcess(result, execution.businessKey)
        return result
    }

    override fun sendMessageToAll(message: String, execution: DelegateExecution): List<MessageCorrelationResult> {
        val results = correlateAll(message, execution.businessKey, execution.variables)
        results.forEach { associateDocumentToProcess(it, execution.businessKey) }
        return results
    }

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

        // The case's own processes are delivered to exactly like sendCatchEventMessageToAll,
        // including the ProcessDocumentInstance association.
        val caseResults = sendCatchEventMessageToAll(message, caseBusinessKey, variables)

        // Building blocks run under their own document id as business key. They get the message too,
        // but deliberately without a case association: their processes belong to the BB document.
        val buildingBlockResults = businessKeyProviders
            .flatMap { it.getBusinessKeysForCase(caseDocumentId) }
            .distinct()
            .filterNot { it == caseBusinessKey }
            .flatMap { correlateAll(message, it, variables) }

        val results = caseResults + buildingBlockResults
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
            .map { correlateWithProcessDefinitionId(message, caseDocumentId.toString(), it, variables) }

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

    private fun resolveCaseDocumentId(documentId: UUID): UUID {
        return runWithoutAuthorization { caseDocumentResolver.resolveCaseDocumentId(documentId) }
    }

    private fun getLatestProcessDefinitionIdByKey(processDefinitionKey: String): OperatonProcessDefinition {
        return runWithoutAuthorization {
            operatonRepositoryService.findProcessDefinition(byKey(processDefinitionKey).and(byLatestVersion()))
                ?: throw RuntimeException("Failed to get process definition with key $processDefinitionKey")
        }
    }

    private fun associationExists(processInstanceId: String): Boolean {
        return runWithoutAuthorization {
            associationService.findProcessDocumentInstance(OperatonProcessInstanceId(processInstanceId)).isPresent
        }
    }

    private fun associateDocumentToProcess(result: MessageCorrelationResult, businessKey: String) {
        if (result.processInstance?.processDefinitionId != null) {
            val processName = getProcessDefinitionName(result.processInstance.processDefinitionId)
            associateDocumentToProcess(result.processInstance.id, processName, businessKey)
        } else {
            val processInstanceId = result.execution.processInstanceId
            val processName = getProcessDefinitionNameByProcessInstanceId(processInstanceId)
            associateDocumentToProcess(processInstanceId, processName, businessKey)
        }
    }

    private fun associateDocumentToProcess(
        processInstanceId: String,
        processName: String,
        businessKey: String
    ) {
        runWithoutAuthorization {
            if (!associationExists(processInstanceId)) {
                val document = documentService[businessKey]
                associationService.createProcessDocumentInstance(
                    processInstanceId,
                    document.id().id,
                    processName
                )
            }
        }
    }

    private fun correlate(
        message: String,
        businessKey: String?,
        variables: Map<String, Any?>?
    ): MessageCorrelationResult {
        val builder = runtimeService.createMessageCorrelation(message)
        businessKey?.let { builder.processInstanceBusinessKey(it) }
        variables?.run { builder.setVariables(variables) }
        return builder.correlateWithResult()
    }

    private fun correlateWithProcessDefinitionId(
        message: String,
        businessKey: String,
        processDefinitionId: String,
        variables: Map<String, Any?>?,
    ): ProcessInstance {
        val builder = runtimeService.createMessageCorrelation(message)
        builder.processDefinitionId(processDefinitionId)
        builder.processInstanceBusinessKey(businessKey)
        variables?.run { builder.setVariables(variables) }
        return builder.correlateStartMessage()
    }

    private fun correlateAll(
        message: String,
        businessKey: String?,
        variables: Map<String, Any?>?
    ): List<MessageCorrelationResult> {
        val builder = runtimeService.createMessageCorrelation(message)
        businessKey?.let { builder.processInstanceBusinessKey(it) }
        variables?.run { builder.setVariables(variables) }
        return builder.correlateAllWithResult()
    }

    private fun getProcessDefinitionName(processDefinitionId: String): String {
        val process = runWithoutAuthorization {
            operatonRepositoryService.findProcessDefinitionById(processDefinitionId)
                ?: throw IllegalStateException("No process definition exists with id '$processDefinitionId'")
        }

        return process.name
            ?: throw IllegalStateException("Process definition with id '$processDefinitionId' doesn't have a name")
    }

    private fun getProcessDefinitionNameByProcessInstanceId(processInstanceId: String): String {
        return runWithoutAuthorization {
            val processInstance = operatonRuntimeService.findProcessInstanceById(processInstanceId)!!
            getProcessDefinitionName(processInstance.processDefinitionId)
        }
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