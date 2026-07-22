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
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.processdocument.domain.impl.ProcessDocumentInstanceDto
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException

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
    private val processDocumentAssociationService: ProcessDocumentAssociationService,
) {

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
}
