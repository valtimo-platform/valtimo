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

package com.ritense.buildingblock.listener

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.authorization.request.DelegateUserEntityAuthorizationRequest
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.event.DocumentAssigneeChangedEvent
import com.ritense.document.event.DocumentUnassignedEvent
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.operaton.authorization.OperatonTaskActionProvider
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byAssigned
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byRootProcessInstanceBusinessKeys
import com.ritense.valtimo.service.OperatonTaskService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class BuildingBlockCaseAssigneeListener(
    private val operatonTaskService: OperatonTaskService,
    private val documentService: DocumentService,
    private val caseDefinitionService: CaseDefinitionService,
    private val userManagementService: UserManagementService,
    private val caseDocumentResolver: CaseDocumentResolver,
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val authorizationService: AuthorizationService,
) {

    @EventListener(DocumentAssigneeChangedEvent::class)
    fun updateAssigneeOnBuildingBlockTasks(event: DocumentAssigneeChangedEvent) {
        try {
            val caseDocumentId = runWithoutAuthorization {
                caseDocumentResolver.resolveCaseDocumentId(event.documentId)
            }
            val caseDocument = runWithoutAuthorization { documentService[caseDocumentId.toString()] }
            val caseDefinition = runWithoutAuthorization {
                caseDefinitionService.getCaseDefinition(
                    caseDocument.definitionId().caseDefinitionId()
                )
            }

            if (caseDefinition.canHaveAssignee && caseDefinition.autoAssignTasks) {
                val businessKeys = buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)
                    .map { it.documentId.toString() }
                if (businessKeys.isEmpty()) return

                val assigneeUsername = caseDocument.assigneeId()
                if (assigneeUsername != null) {
                    val assignee = runWithoutAuthorization { userManagementService.findByUsername(assigneeUsername) }
                    val tasks = runWithoutAuthorization {
                        operatonTaskService.findTasks(
                            byRootProcessInstanceBusinessKeys(businessKeys)
                        )
                    }
                    logger.debug { "Updating assignee on ${tasks.size} task(s)" }
                    tasks.forEach { task ->
                        if (authorizationService.hasPermission(
                                DelegateUserEntityAuthorizationRequest(
                                    OperatonTask::class.java,
                                    OperatonTaskActionProvider.ASSIGNABLE,
                                    assigneeUsername,
                                    task
                                )
                            )
                        ) {
                            runWithoutAuthorization {
                                operatonTaskService.assign(task.id, assignee.id)
                            }
                        }
                    }
                }
            }
        } catch (e: CaseDocumentResolutionException) {
            logger.debug { "Could not resolve case document for document ${event.documentId}: ${e.message}" }
        }
    }

    @RunWithoutAuthorization
    @EventListener(DocumentUnassignedEvent::class)
    fun removeAssigneeFromBuildingBlockTasks(event: DocumentUnassignedEvent) {
        try {
            val caseDocumentId = caseDocumentResolver.resolveCaseDocumentId(event.documentId)
            val caseDocument = documentService[caseDocumentId.toString()]
            val caseDefinition: CaseDefinition = caseDefinitionService.getCaseDefinition(
                caseDocument.definitionId().caseDefinitionId()
            )

            if (caseDefinition.canHaveAssignee && caseDefinition.autoAssignTasks) {
                val businessKeys = buildingBlockInstanceRepository.findAllByCaseDocumentId(caseDocumentId)
                    .map { it.documentId.toString() }
                if (businessKeys.isEmpty()) return

                val tasks = operatonTaskService.findTasks(
                    byRootProcessInstanceBusinessKeys(businessKeys)
                        .and(byAssigned())
                )
                logger.debug { "Removing assignee from ${tasks.size} building block task(s)" }
                tasks.forEach { task ->
                    operatonTaskService.unassign(task.id)
                }
            }
        } catch (e: CaseDocumentResolutionException) {
            logger.debug { "Could not resolve case document for document ${event.documentId}: ${e.message}" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}