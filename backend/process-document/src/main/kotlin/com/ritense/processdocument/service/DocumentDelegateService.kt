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

import com.fasterxml.jackson.core.JsonPointer
import com.fasterxml.jackson.core.JsonProcessingException
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.valtimo.contract.annotation.ProcessBean
import com.ritense.valtimo.contract.annotation.ProcessBeanMethod
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.springframework.stereotype.Service
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID
import kotlin.jvm.optionals.getOrNull

@ProcessBean(description = "Case document metadata, assignments, tags, and status")
@Service
@SkipComponentScan
class DocumentDelegateService(
    private val processDocumentService: ProcessDocumentService,
    private val documentService: DocumentService,
    private val jsonSchemaDocumentService: JsonSchemaDocumentService,
    private val userManagementService: UserManagementService,
    private val objectMapper: ObjectMapper,
    private val caseDocumentResolver: CaseDocumentResolver,
) {

    @ProcessBeanMethod(description = "Gets the version number of the case document")
    fun getDocumentVersion(execution: DelegateExecution): Int? {
        logger.debug("Get version of document {}", execution.processBusinessKey)
        return getDocument(execution).version()
    }

    @ProcessBeanMethod(description = "Gets the creation timestamp of the case document")
    fun getDocumentCreatedOn(execution: DelegateExecution): LocalDateTime? {
        logger.debug("Get created on date of document {}", execution.processBusinessKey)
        return getDocument(execution).createdOn()
    }

    @ProcessBeanMethod(description = "Gets the user ID who created the case document")
    fun getDocumentCreatedBy(execution: DelegateExecution): String? {
        logger.debug("Get created by of document {}", execution.processBusinessKey)
        return getDocument(execution).createdBy()
    }

    @ProcessBeanMethod(description = "Gets the last modification timestamp of the case document")
    fun getDocumentModifiedOn(execution: DelegateExecution): LocalDateTime? {
        logger.debug("Get modified on of document {}", execution.processBusinessKey)
        return getDocument(execution).modifiedOn().getOrNull()
    }

    @ProcessBeanMethod(description = "Gets the assignee user ID of the case document")
    fun getDocumentAssigneeId(execution: DelegateExecution): String? {
        logger.debug("Get assigneeId of document {}", execution.processBusinessKey)
        return getDocument(execution).assigneeId()
    }

    @ProcessBeanMethod(description = "Gets the assignee full name of the case document")
    fun getDocumentAssigneeFullName(execution: DelegateExecution): String? {
        logger.debug("Get assignee full name of document {}", execution.processBusinessKey)
        return getDocument(execution).assigneeFullName()
    }

    @ProcessBeanMethod(description = "Gets the full case document object")
    fun getDocument(execution: DelegateExecution): Document {
        val documentId =
            processDocumentService.getDocumentId(OperatonProcessInstanceId(execution.processInstanceId), execution)
        return jsonSchemaDocumentService.getDocumentBy(documentId)
    }

    @ProcessBeanMethod(
        description = "Gets a value from the case document by JSON pointer",
        example = "\${documentDelegateService.findValueByJsonPointer('/customer/name', execution)}"
    )
    fun findValueByJsonPointer(jsonPointer: String?, execution: DelegateExecution?): Any {
        return findOptionalValueByJsonPointer(jsonPointer, execution!!).orElseThrow()
    }

    @ProcessBeanMethod(
        description = "Gets a value from the case document by JSON pointer, or returns a default value",
        example = "\${documentDelegateService.findValueByJsonPointerOrDefault('/customer/name', execution, 'Unknown')}"
    )
    fun findValueByJsonPointerOrDefault(jsonPointer: String?, execution: DelegateExecution, defaultValue: Any?): Any? {
        return findOptionalValueByJsonPointer(jsonPointer, execution).orElse(defaultValue)
    }

    @ProcessBeanMethod(
        description = "Assigns a user to the case document by email",
        example = "\${documentDelegateService.setAssignee(execution, 'user@example.com')}"
    )
    fun setAssignee(execution: DelegateExecution, userEmail: String?) {
        if (userEmail == null) {
            unassign(execution)
        }
        logger.debug("Assigning user {} to document {}", userEmail, execution.processBusinessKey)

        val caseDocumentId = getCaseDocumentId(execution)
        val user = runWithoutAuthorization { userManagementService.findByEmail(userEmail) }
            .orElseThrow { IllegalArgumentException("No user found with email: $userEmail") }
        documentService.assignUserToDocument(caseDocumentId, user.id)
    }

    @ProcessBeanMethod(
        description = "Sets the internal status of the case document",
        example = "\${documentDelegateService.setInternalStatus(execution, 'in-progress')}"
    )
    fun setInternalStatus(execution: DelegateExecution, statusKey: String?) {
        val caseDocumentId = getCaseDocumentId(execution)

        documentService.setInternalStatus(JsonSchemaDocumentId.existingId(caseDocumentId), statusKey)
    }

    @ProcessBeanMethod(
        description = "Adds a tag to the case document",
        example = "\${documentDelegateService.addCaseTag(execution, 'urgent')}"
    )
    fun addCaseTag(execution: DelegateExecution, caseTagKey: String) {
        val caseDocumentId = getCaseDocumentId(execution)

        documentService.addCaseTag(JsonSchemaDocumentId.existingId(caseDocumentId), caseTagKey)
    }

    @ProcessBeanMethod(
        description = "Removes a tag from the case document",
        example = "\${documentDelegateService.removeCaseTag(execution, 'urgent')}"
    )
    fun removeCaseTag(execution: DelegateExecution, caseTagKey: String) {
        val caseDocumentId = getCaseDocumentId(execution)

        documentService.removeCaseTag(JsonSchemaDocumentId.existingId(caseDocumentId), caseTagKey)
    }

    @ProcessBeanMethod(description = "Removes the assignee from the case document")
    fun unassign(execution: DelegateExecution) {
        logger.debug("Unassigning user from document {}", execution.processBusinessKey)

        val caseDocumentId = getCaseDocumentId(execution)
        documentService.unassignUserFromDocument(caseDocumentId)
    }

    private fun getCaseDocumentId(execution: DelegateExecution): UUID {
        val processInstanceId = OperatonProcessInstanceId(execution.processInstanceId)
        val documentId = processDocumentService.getDocumentId(processInstanceId, execution)
        return caseDocumentResolver.resolveCaseDocumentId(documentId.id)
    }

    private fun findOptionalValueByJsonPointer(jsonPointer: String?, execution: DelegateExecution): Optional<Any> {
        val jsonSchemaDocumentId = JsonSchemaDocumentId.existingId(UUID.fromString(execution.processBusinessKey))
        logger.debug("Retrieving value for key {} from documentId {}", jsonPointer, execution.processBusinessKey)

        return documentService.findBy(jsonSchemaDocumentId)
            .flatMap { jsonSchemaDocument ->
                jsonSchemaDocument.content().getValueBy(JsonPointer.valueOf(jsonPointer))
            }
            .map(::transform)
    }

    private fun transform(jsonNode: JsonNode): Any? {
        if (jsonNode.isNumber) {
            // Removing this would result in a breaking change, as 3.0 will become an int when using treeToValue
            return jsonNode.asDouble()
        } else if (jsonNode.isValueNode || jsonNode.isContainerNode) {
            try {
                return objectMapper.treeToValue(jsonNode, Any::class.java)
            } catch (e: JsonProcessingException) {
                logger.error("Could not transform JsonNode of type \"" + jsonNode.nodeType + "\"", e)
            }
        } else {
            logger.debug(
                "JsonNode of type \"" + jsonNode.nodeType + "\" cannot be transformed to a value. Returning null."
            )
        }
        return null
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }


}