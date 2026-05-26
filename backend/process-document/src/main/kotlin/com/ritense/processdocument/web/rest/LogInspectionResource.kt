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
import com.ritense.logging.repository.LoggingEventSpecificationHelper.Companion.byAnyOfProperties
import com.ritense.logging.repository.LoggingEventSpecificationHelper.Companion.byLikeFormattedMessage
import com.ritense.logging.repository.LoggingEventSpecificationHelper.Companion.byMinimumLevel
import com.ritense.logging.repository.LoggingEventSpecificationHelper.Companion.byNewerThan
import com.ritense.logging.repository.LoggingEventSpecificationHelper.Companion.byOlderThan
import com.ritense.logging.repository.LoggingEventSpecificationHelper.Companion.byProperty
import com.ritense.logging.repository.LoggingEventSpecificationHelper.Companion.query
import com.ritense.logging.scope.CaseLogScopeContributor
import com.ritense.logging.service.LoggingEventService
import com.ritense.logging.web.rest.dto.LoggingEventResponse
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
    private val scopeContributors: List<CaseLogScopeContributor>,
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

        val spec = buildSpec(caseId, request)

        val page = loggingEventService.searchLoggingEvents(spec, pageable)
        val responses = LoggingEventResponse.of(page.content)
        return ResponseEntity.ok(PageImpl(responses, pageable, page.totalElements))
    }

    private fun buildSpec(
        caseId: UUID,
        request: LogInspectionSearchRequest,
    ) = buildList<org.springframework.data.jpa.domain.Specification<com.ritense.logging.domain.LoggingEvent>> {
        add(query())
        add(byAnyOfProperties(buildScope(caseId)))

        request.afterTimestamp?.let { add(byNewerThan(it)) }
        request.beforeTimestamp?.let { add(byOlderThan(it)) }
        request.level?.let { add(byMinimumLevel(it)) }
        request.likeFormattedMessage?.let { add(byLikeFormattedMessage(it)) }

        request.additionalProperties
            .filterNot { it.key == JSON_SCHEMA_DOCUMENT_KEY }
            .forEach { add(byProperty(it.key, it.value)) }
    }.reduce { acc, next -> acc.and(next) }

    private fun buildScope(caseId: UUID): Map<String, Collection<String>> {
        val scope = mutableMapOf<String, MutableSet<String>>()
        scope.getOrPut(JSON_SCHEMA_DOCUMENT_KEY) { mutableSetOf() } += caseId.toString()

        scopeContributors.forEach { contributor ->
            contributor.scopeFor(caseId).forEach { entry ->
                scope.getOrPut(entry.key) { mutableSetOf() } += entry.values
            }
        }
        return scope
    }

    companion object {
        val JSON_SCHEMA_DOCUMENT_KEY: String = JsonSchemaDocument::class.java.canonicalName
    }
}
