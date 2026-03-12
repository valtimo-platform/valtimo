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
import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.event.DocumentAssigneeChangedEvent
import com.ritense.document.event.DocumentUnassignedEvent
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.document.CaseDocumentResolutionException
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byAssigned
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byCandidateGroups
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byProcessInstanceBusinessKey
import com.ritense.valtimo.service.OperatonTaskService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class CaseAssigneeListener(
    private val operatonTaskService: OperatonTaskService,
    private val documentService: DocumentService,
    private val caseDefinitionService: CaseDefinitionService,
    private val userManagementService: UserManagementService,
    private val caseDocumentResolver: CaseDocumentResolver
) {

    @RunWithoutAuthorization
    @EventListener(DocumentAssigneeChangedEvent::class)
    fun updateAssigneeOnTasks(event: DocumentAssigneeChangedEvent) {
        try {
            val caseDocumentId = caseDocumentResolver.resolveCaseDocumentId(event.documentId)
            val caseDocument = documentService[caseDocumentId.toString()]
            val caseDefinition: CaseDefinition = caseDefinitionService.getCaseDefinition(
                caseDocument.definitionId().caseDefinitionId()
            )

            if (caseDefinition.canHaveAssignee && caseDefinition.autoAssignTasks) {
                val assignee = runWithoutAuthorization { userManagementService.findByUsername(caseDocument.assigneeId()) }
                val tasks = operatonTaskService.findTasks(
                    byProcessInstanceBusinessKey(caseDocument.id().toString())
                        .and(byCandidateGroups(assignee.roles))
                )
                logger.debug { "Updating assignee on ${tasks.size} task(s)" }
                tasks.forEach { task ->
                    operatonTaskService.assign(task.id, assignee.id)
                }
            }
        } catch (e: CaseDocumentResolutionException) {
            logger.debug { "Could not resolve case document for document ${event.documentId}: ${e.message}" }
        }
    }

    @RunWithoutAuthorization
    @EventListener(DocumentUnassignedEvent::class)
    fun removeAssigneeFromTasks(event: DocumentUnassignedEvent) {
        try {
            val caseDocumentId = caseDocumentResolver.resolveCaseDocumentId(event.documentId)
            val caseDocument = documentService[caseDocumentId.toString()]
            val caseDefinition: CaseDefinition = caseDefinitionService.getCaseDefinition(
                caseDocument.definitionId().caseDefinitionId()
            )
            if (caseDefinition.canHaveAssignee && caseDefinition.autoAssignTasks) {
                val tasks = operatonTaskService.findTasks(
                    byProcessInstanceBusinessKey(caseDocument.id().toString())
                        .and(byAssigned())
                )
                logger.debug { "Removing assignee from ${tasks.size} task(s)" }
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