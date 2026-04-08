/*
 *  Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package com.ritense.processdocument.sse.domain.listener

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processdocument.sse.event.TaskUpdateSseEvent
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.contract.event.TaskTeamAssignedEvent
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valtimo.web.sse.service.SseSubscriptionService
import org.operaton.bpm.spring.boot.starter.event.TaskEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.event.TransactionalEventListener

@Component
@SkipComponentScan
class TaskUpdateListener(
    private val sseSubscriptionService: SseSubscriptionService,
    private val processDocumentService: ProcessDocumentService,
    private val caseDocumentResolver: CaseDocumentResolver,
    private val documentService: DocumentService,
    private val operatonTaskService: OperatonTaskService,
) {

    @TransactionalEventListener(
        condition = "#taskEvent.eventName=='create' " +
            "|| #taskEvent.eventName=='assignment' " +
            "|| #taskEvent.eventName=='complete' " +
            "|| #taskEvent.eventName=='delete'",
        fallbackExecution = true
    )
    fun handle(taskEvent: TaskEvent) {
        val document = processDocumentService.getDocument(OperatonProcessInstanceId(taskEvent.processInstanceId), null)
        notifyTaskUpdate(taskEvent.id, document)
    }

    @Transactional
    @EventListener
    fun handleTeamAssignment(event: TaskTeamAssignedEvent) = runWithoutAuthorization {
        val task = operatonTaskService.findTaskById(event.taskId)
        val processInstanceId = OperatonProcessInstanceId(task.getProcessInstanceId())
        val document = processDocumentService.getDocument(processInstanceId, task)
        notifyTaskUpdate(event.taskId, document)
    }

    private fun notifyTaskUpdate(taskId: String, document: com.ritense.document.domain.Document) {
        val caseDocumentId = caseDocumentResolver.resolveCaseDocumentId(document.id().id)
        val caseDocument = if (caseDocumentId == document.id().id) {
            document
        } else {
            documentService[caseDocumentId.toString()]
        }
        sseSubscriptionService.notifySubscribers(
            TaskUpdateSseEvent(
                taskId = taskId,
                documentId = caseDocument.id().toString(),
                caseDefinitionKey = caseDocument.definitionId().name(),
            )
        )
    }

}