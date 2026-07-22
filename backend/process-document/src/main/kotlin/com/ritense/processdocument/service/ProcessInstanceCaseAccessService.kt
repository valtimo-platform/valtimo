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

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.ProcessDocumentInstanceDto
import org.operaton.bpm.engine.RuntimeService
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

/**
 * Shared case-scoped access checks for endpoints that operate on the runtime state
 * of a process instance belonging to a specific case.
 *
 * Loads and authorizes the case document, verifies that a process instance actually
 * belongs to the case, and verifies that the instance is still active. Used by both
 * [com.ritense.processdocument.web.rest.ProcessInspectionResource] and
 * [com.ritense.processdocument.web.rest.ProcessTimerResource].
 */
open class ProcessInstanceCaseAccessService(
    private val documentService: DocumentService,
    private val authorizationService: AuthorizationService,
    private val processDocumentAssociationService: ProcessDocumentAssociationService,
    private val runtimeService: RuntimeService,
) {

    open fun loadAndAuthorize(caseId: UUID, action: Action<JsonSchemaDocument>): JsonSchemaDocument {
        val document = runWithoutAuthorization {
            documentService.findBy(JsonSchemaDocumentId.existingId(caseId)).orElseThrow()
        } as JsonSchemaDocument

        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                JsonSchemaDocument::class.java,
                action,
                document,
            )
        )

        return document
    }

    open fun requireBelongsToCase(caseId: UUID, processInstanceId: String) {
        val belongs = runWithoutAuthorization {
            processDocumentAssociationService.findProcessDocumentInstanceDtos(
                JsonSchemaDocumentId.existingId(caseId)
            )
        }.any { (it as ProcessDocumentInstanceDto).processDocumentInstanceId().processInstanceId().toString() == processInstanceId }

        if (!belongs) {
            throw ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Process instance $processInstanceId is not associated with case $caseId"
            )
        }
    }

    open fun requireActive(processInstanceId: String) {
        val active = runWithoutAuthorization {
            runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult()
        }
        if (active == null) {
            throw ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Process instance $processInstanceId is not active"
            )
        }
    }
}
