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

package com.ritense.processdocument.listener

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.DelegateUserEntityAuthorizationRequest
import com.ritense.case.service.CaseDefinitionService
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.event.OperatonTaskEvent
import com.ritense.valtimo.operaton.authorization.OperatonTaskActionProvider
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.operaton.repository.OperatonTaskRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.TaskService
import org.springframework.context.event.EventListener
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Component
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.UUID
import kotlin.jvm.optionals.getOrNull

@Component
@SkipComponentScan
open class CaseAssigneeTaskCreatedListener(
    private val taskService: TaskService,
    private val documentService: DocumentService,
    private val caseDefinitionService: CaseDefinitionService,
    private val userManagementService: UserManagementService,
    private val caseDocumentResolver: CaseDocumentResolver,
    private val authorizationService: AuthorizationService,
    private val operatonTaskRepository: OperatonTaskRepository,
) {

    @EventListener(
        condition = """#event.delegateTask.bpmnModelElementInstance != null
            && #event.delegateTask.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).TASK_USER_TASK
            && #event.eventName == T(org.operaton.bpm.engine.delegate.TaskListener).EVENTNAME_CREATE"""
    )
    fun notify(event: OperatonTaskEvent) {
        val delegateTask = event.delegateTask
        val documentId = UUID.fromString(delegateTask.execution.businessKey)

        try {
            val caseDocument = runWithoutAuthorization {
                val caseDocumentId = caseDocumentResolver.resolveCaseDocumentId(documentId)
                documentService.findBy(JsonSchemaDocumentId.existingId(caseDocumentId)).getOrNull()
            } ?: return

            val caseDefinition = runWithoutAuthorization {
                caseDefinitionService.getCaseDefinition(
                    caseDocument.definitionId().caseDefinitionId()
                )
            }

            if (caseDefinition != null) {
                if (
                    caseDefinition.canHaveAssignee
                    && caseDefinition.autoAssignTasks
                    && !caseDocument.assigneeId().isNullOrEmpty()
                ) {
                    val assignee = runWithoutAuthorization { userManagementService.findByUsername(caseDocument.assigneeId()) }
                    val taskId = delegateTask.id

                    TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
                        override fun beforeCommit(readOnly: Boolean) {
                            val operatonTask = runWithoutAuthorization {
                                operatonTaskRepository.findById(taskId).getOrNull()
                            } ?: return

                            try {
                                authorizationService.requirePermission(
                                    DelegateUserEntityAuthorizationRequest(
                                        OperatonTask::class.java,
                                        OperatonTaskActionProvider.ASSIGNABLE,
                                        assignee.username,
                                        operatonTask
                                    )
                                )

                                taskService.setAssignee(taskId, assignee.username)
                                logger.debug { "Setting assignee for task with id $taskId" }
                            } catch (_: AccessDeniedException) {
                                logger.info { "Auto assigning user to task ${taskId} failed." }
                            }
                        }
                    })
                }
            }
        } catch (e: CaseDocumentResolutionException) {
            logger.debug { "Could not resolve case document for document $documentId: ${e.message}" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger { }
    }
}