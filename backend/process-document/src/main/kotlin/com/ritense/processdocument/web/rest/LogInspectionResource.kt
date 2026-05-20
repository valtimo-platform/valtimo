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
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.logging.LoggableResource
import com.ritense.logging.service.LoggingEventService
import com.ritense.logging.web.rest.dto.LoggingEventPropertyDto
import com.ritense.logging.web.rest.dto.LoggingEventResponse
import com.ritense.logging.web.rest.dto.LoggingEventSearchRequest
import com.ritense.processdocument.web.rest.dto.LogInspectionSearchRequest
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.http.ResponseEntity
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@SkipComponentScan
@RequestMapping("/api/management", produces = [APPLICATION_JSON_UTF8_VALUE])
class LogInspectionResource(
    private val documentService: DocumentService,
    private val authorizationService: AuthorizationService,
    private val loggingEventService: LoggingEventService,
) {

    @Transactional(readOnly = true)
    @PostMapping("/v1/case/{caseId}/logs")
    fun searchCaseLogs(
        @LoggableResource(resourceType = JsonSchemaDocument::class) @PathVariable caseId: UUID,
        @RequestBody request: LogInspectionSearchRequest,
        @PageableDefault(sort = ["timestamp"], direction = Sort.Direction.DESC) pageable: Pageable,
    ): ResponseEntity<Page<LoggingEventResponse>> {
        val document = runWithoutAuthorization {
            documentService.findBy(JsonSchemaDocumentId.existingId(caseId)).orElseThrow()
        } as JsonSchemaDocument

        authorizationService.requirePermission(
            EntityAuthorizationRequest(
                JsonSchemaDocument::class.java,
                JsonSchemaDocumentActionProvider.INSPECT,
                document,
            )
        )

        val casePropertyKey = JsonSchemaDocument::class.java.canonicalName
        val casePin = LoggingEventPropertyDto(casePropertyKey, caseId.toString())

        val properties = request.additionalProperties
            .filterNot { it.key == casePropertyKey }
            .plus(casePin)

        val searchRequest = LoggingEventSearchRequest(
            afterTimestamp = request.afterTimestamp,
            beforeTimestamp = request.beforeTimestamp,
            level = request.level,
            likeFormattedMessage = request.likeFormattedMessage,
            properties = properties,
        )

        val page = loggingEventService.searchLoggingEvents(searchRequest, pageable)
        val responses = LoggingEventResponse.of(page.content)
        return ResponseEntity.ok(PageImpl(responses, pageable, page.totalElements))
    }
}
