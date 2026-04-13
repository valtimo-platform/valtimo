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

package com.ritense.processdocument.listener

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.event.DocumentAssigneeChangedEvent
import com.ritense.document.event.DocumentUnassignedEvent
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.TeamManagementService
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.event.OperatonTaskEvent
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byCandidateGroups
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byRootProcessInstanceBusinessKey
import com.ritense.valtimo.operaton.repository.OperatonTaskSpecificationHelper.Companion.byTeamKey
import com.ritense.valtimo.service.OperatonTaskService
import io.github.oshai.kotlinlogging.KotlinLogging
import java.util.UUID
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager

@Component
@SkipComponentScan
class CaseTaskTeamAutoAssignListener(
    private val operatonTaskService: OperatonTaskService,
    private val documentService: DocumentService,
    private val caseDefinitionService: CaseDefinitionService,
    private val processDocumentService: ProcessDocumentService,
    private val teamManagementService: TeamManagementService?,
    private val caseDocumentResolver: CaseDocumentResolver,
) {

    @RunWithoutAuthorization
    @EventListener(
        condition = """#event.delegateTask.bpmnModelElementInstance != null
            && #event.delegateTask.bpmnModelElementInstance.elementType.typeName == T(org.operaton.bpm.engine.ActivityTypes).TASK_USER_TASK
            && #event.eventName == T(org.operaton.bpm.engine.delegate.TaskListener).EVENTNAME_CREATE"""
    )
    @Transactional
    fun assignTeamFromCandidateGroup(event: OperatonTaskEvent) {
        if (teamManagementService == null) {
            return
        }

        val delegateTask = event.delegateTask
        val processInstanceId = OperatonProcessInstanceId(delegateTask.processInstanceId)
        val caseDocument = processDocumentService.getCaseDocument(processInstanceId, delegateTask.execution)
            ?: return

        val caseDefinition = caseDefinitionService.getCaseDefinition(
            caseDocument.definitionId().caseDefinitionId()
        )

        if (!caseDefinition.canHaveAssignee || !caseDefinition.autoAssignTasks) {
            return
        }

        val candidateGroupIds = delegateTask.candidates.map { it.groupId }
        val teamKey = caseDocument.assignedTeamKey()?.takeIf { it in candidateGroupIds }
            ?: candidateGroupIds.firstOrNull { teamManagementService.findByKey(it) != null }
            ?: return

        val taskId = delegateTask.id
        TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
            override fun beforeCommit(readOnly: Boolean) {
                operatonTaskService.assignTeamToTask(taskId, teamKey)
                logger.debug { "Auto assigning team '$teamKey' to task '$taskId'" }
            }
        })
    }

    @RunWithoutAuthorization
    @EventListener(DocumentAssigneeChangedEvent::class)
    @Transactional
    fun updateTeamOnTasksForDocument(event: DocumentAssigneeChangedEvent) {
        if (teamManagementService == null) {
            return
        }

        val caseDocument = getEligibleCaseDocument(event.documentId)
            ?: return

        val teamKey = caseDocument.assignedTeamKey()
            ?: return

        val tasks = operatonTaskService.findTasks(
            byRootProcessInstanceBusinessKey(caseDocument.id().toString())
                .and(byCandidateGroups(teamKey))
                .and(byTeamKey(event.formerTeamKey))
        )

        logger.debug { "Auto assigning team '$teamKey' on ${tasks.size} task(s)" }
        for (task in tasks) {
            operatonTaskService.assignTeamToTask(task.id, teamKey)
        }
    }

    @RunWithoutAuthorization
    @EventListener(DocumentUnassignedEvent::class)
    @Transactional
    fun removeTeamFromTasksForDocument(event: DocumentUnassignedEvent) {
        if (teamManagementService == null) {
            return
        }

        val formerTeamKey = event.teamKey
            ?: return

        val caseDocument = getEligibleCaseDocument(event.documentId)
            ?: return

        val tasks = operatonTaskService.findTasks(
            byRootProcessInstanceBusinessKey(caseDocument.id().toString())
                .and(byTeamKey(formerTeamKey))
        )

        logger.debug { "Unassign team from ${tasks.size} task(s)" }
        for (task in tasks) {
            operatonTaskService.unassignTeamFromTask(task.id)
        }
    }

    private fun getEligibleCaseDocument(documentId: UUID): Document? {
        val caseDocumentId = caseDocumentResolver.resolveCaseDocumentId(documentId)

        val caseDocument = documentService.findBy(JsonSchemaDocumentId.existingId(caseDocumentId))
            .orElse(null)
            ?: return null

        val caseDefinition = caseDefinitionService.getCaseDefinition(
            caseDocument.definitionId().caseDefinitionId()
        )

        if (!caseDefinition.canHaveAssignee || !caseDefinition.autoAssignTasks) {
            return null
        }

        return caseDocument
    }

    companion object {
        private val logger = KotlinLogging.logger { }
    }
}
