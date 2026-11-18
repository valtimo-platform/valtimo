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

package com.ritense.form.service

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.form.domain.FormIoFormDefinition
import com.ritense.form.domain.FormProcessLink
import com.ritense.form.domain.IntermediateSubmission
import com.ritense.form.domain.submission.formfield.FormField
import com.ritense.form.domain.submission.formfield.UploadField
import com.ritense.form.exception.TaskFormNotFoundException
import com.ritense.form.repository.IntermediateSubmissionRepository
import com.ritense.form.service.impl.FormIoFormDefinitionService
import com.ritense.form.util.EventDispatcherHelper.Companion.dispatchEvents
import com.ritense.logging.LoggableResource
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.resource.service.ResourceService
import com.ritense.valtimo.operaton.authorization.OperatonTaskActionProvider.Companion.COMPLETE
import com.ritense.valtimo.operaton.authorization.OperatonTaskActionProvider.Companion.VIEW
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.service.OperatonTaskService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.ObjectProvider
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import kotlin.jvm.optionals.getOrNull

@Transactional
@Service
@SkipComponentScan
class IntermediateSubmissionService(
    private val intermediateSubmissionRepository: IntermediateSubmissionRepository,
    private val userManagementService: UserManagementService,
    private val authorizationService: AuthorizationService,
    private val operatonTaskService: OperatonTaskService,
    private val processLinkService: ProcessLinkService,
    private val formDefinitionService: FormIoFormDefinitionService,
    private val processDocumentAssociationService: ProcessDocumentAssociationService,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val resourceService: ObjectProvider<ResourceService>
) {

    fun get(
        @LoggableResource(resourceType = OperatonTask::class) taskInstanceId: String
    ): IntermediateSubmission? {
        val task = operatonTaskService.findTaskById(taskInstanceId)
        authorizationService.requirePermission(
            EntityAuthorizationRequest(OperatonTask::class.java, VIEW, task)
        )
        val stored = intermediateSubmissionRepository.getByTaskInstanceId(taskInstanceId)
        val formDefinition = getFormDefinition(task)
        return stored?.let {
            IntermediateSubmission(
                intermediateSubmissionId = it.intermediateSubmissionId,
                taskInstanceId = it.taskInstanceId,
                content = formDefinition.removeNonSubmittableData(it.content) as ObjectNode,
                createdOn = it.createdOn,
                createdBy = it.createdBy,
                editedBy = it.editedBy,
                editedOn = it.editedOn
            )
        }
    }

    fun store(
        submission: ObjectNode,
        @LoggableResource(resourceType = OperatonTask::class) taskInstanceId: String
    ): IntermediateSubmission {
        val task = operatonTaskService.findTaskById(taskInstanceId)
        authorizationService.requirePermission(
            EntityAuthorizationRequest(OperatonTask::class.java, COMPLETE, task)
        )
        val formDefinition = getFormDefinition(task)
        val sanitizedSubmission = formDefinition.removeNonSubmittableData(submission) as ObjectNode
        claimUploads(task, formDefinition, sanitizedSubmission)
        val currentUser: String = userManagementService.currentUser.username
        val existingIntermediateSubmission = intermediateSubmissionRepository.getByTaskInstanceId(taskInstanceId)
        if (existingIntermediateSubmission != null) {
            return intermediateSubmissionRepository.save(
                existingIntermediateSubmission.changeSubmissionContent(
                    editedBy = currentUser,
                    content = sanitizedSubmission
                )
            ).also {
                dispatchEvents(it)
                logger.info { "Updated existing intermediate submission for taskInstanceId($taskInstanceId)" }
            }
        } else {
            return intermediateSubmissionRepository.save(
                IntermediateSubmission.new(
                    createdBy = currentUser,
                    content = sanitizedSubmission,
                    taskInstanceId = taskInstanceId
                )
            ).also {
                dispatchEvents(it)
                logger.info { "Inserted intermediate submission for taskInstanceId($taskInstanceId)" }
            }
        }
    }

    fun clear(
        @LoggableResource(resourceType = OperatonTask::class) taskInstanceId: String
    ) {
        val task = operatonTaskService.findTaskById(taskInstanceId)
        authorizationService.requirePermission(
            EntityAuthorizationRequest(OperatonTask::class.java, COMPLETE, task)
        )
        intermediateSubmissionRepository.getByTaskInstanceId(taskInstanceId)?.let { intermediateSubmission ->
            intermediateSubmissionRepository.deleteById(intermediateSubmission.intermediateSubmissionId)
        }
    }

    // Claim at save: whoever submits this draft later may not be the uploader
    private fun claimUploads(task: OperatonTask, formDefinition: FormIoFormDefinition, submission: ObjectNode) {
        val resourceService = resourceService.ifAvailable ?: return
        val resourceIds = FormField.getFormFields(formDefinition, submission, applicationEventPublisher)
            .filterIsInstance<UploadField>()
            .flatMap { it.resourceIds() }
        if (resourceIds.isEmpty()) {
            return
        }
        val documentId = runWithoutAuthorization {
            processDocumentAssociationService.findProcessDocumentInstance(
                OperatonProcessInstanceId(task.getProcessInstanceId())
            )
        }.getOrNull()?.processDocumentInstanceId()?.documentId()?.id ?: return
        resourceIds.forEach { resourceService.claimForDocument(it, documentId) }
    }

    private fun getFormDefinition(task: OperatonTask): FormIoFormDefinition {
        val taskDefinitionKey = task.taskDefinitionKey ?: throw TaskFormNotFoundException(task.id)
        val processDefinitionId = task.getProcessDefinitionId()
        val formProcessLink = processLinkService.getProcessLinks(processDefinitionId, taskDefinitionKey)
            .filterIsInstance<FormProcessLink>()
            .firstOrNull()
            ?: throw TaskFormNotFoundException(task.id)
        return formDefinitionService.getFormDefinitionById(formProcessLink.formDefinitionId).orElse(null)
            ?: throw TaskFormNotFoundException(task.id)
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }

}