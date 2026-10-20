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

package com.ritense.processdocument.web.rest

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.findByOrNull
import com.ritense.document.service.requireDocumentPermission
import com.ritense.logging.LoggableResource
import com.ritense.processdocument.service.ProcessInstanceCaseAccessService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import com.ritense.valtimo.service.ProcessInstanceDiagramService
import com.ritense.valtimo.web.rest.dto.ProcessInstanceDiagramDto
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/v1/process-document", produces = [APPLICATION_JSON_UTF8_VALUE])
class CaseProcessDiagramResource(
    private val caseAccessService: ProcessInstanceCaseAccessService,
    private val documentService: DocumentService,
    private val authorizationService: AuthorizationService,
    private val processInstanceDiagramService: ProcessInstanceDiagramService,
) {

    @Transactional(readOnly = true)
    @EndpointDescription(
        en = "Get the BPMN diagram of a process instance belonging to a case",
        nl = "Het BPMN-diagram van een procesinstantie van een zaak ophalen",
    )
    @GetMapping("/case/{caseId}/process-instance/{processInstanceId}/xml")
    fun getProcessInstanceDiagram(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @PathVariable processInstanceId: String,
    ): ResponseEntity<ProcessInstanceDiagramDto> {
        requireViewableCase(caseId)
        caseAccessService.requireBelongsToCase(caseId, processInstanceId)

        val diagram = runWithoutAuthorization {
            processInstanceDiagramService.getProcessInstanceDiagram(processInstanceId)
        }

        return diagram?.let { ResponseEntity.ok(it) } ?: ResponseEntity.notFound().build()
    }

    private fun requireViewableCase(caseId: UUID) {
        val document = runWithoutAuthorization {
            documentService.findByOrNull(JsonSchemaDocumentId.existingId(caseId))
        } as JsonSchemaDocument?
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Case $caseId does not exist")
        authorizationService.requireDocumentPermission(document)
    }
}
