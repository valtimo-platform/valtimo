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

package com.ritense.document.opensearch.web

import com.ritense.document.opensearch.domain.DocumentIndexRejection
import com.ritense.document.opensearch.service.DocumentOpenSearchReconcileService
import com.ritense.document.opensearch.service.IndexCompletenessService
import com.ritense.document.opensearch.service.SearchEngineToggle
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import org.springframework.beans.factory.ObjectProvider
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDateTime
import java.util.UUID

@RestController
@RequestMapping("/api/management/v1/document-opensearch/rejections")
class DocumentOpenSearchRejectionResource(
    private val indexCompletenessService: IndexCompletenessService,
    private val reconcileService: ObjectProvider<DocumentOpenSearchReconcileService>,
    private val toggle: SearchEngineToggle,
) {

    @EndpointDescription(
        en = "List cases OpenSearch could not index",
        nl = "Dossiers ophalen die OpenSearch niet kon indexeren",
    )
    @GetMapping
    fun list(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): ResponseEntity<Page<RejectionDto>> =
        ResponseEntity.ok(indexCompletenessService.rejections(PageRequest.of(page, size)).map(RejectionDto::of))

    @EndpointDescription(
        en = "Retry indexing cases OpenSearch could not index",
        nl = "Indexeren opnieuw proberen van dossiers die OpenSearch niet kon indexeren",
    )
    @PostMapping("/retry")
    fun retry(@RequestBody(required = false) request: RetryRequest?): ResponseEntity<Map<String, Any?>> {
        val reconciler = reconcileService.ifAvailable
        if (reconciler == null || !toggle.isOpenSearchActive() || toggle.isFallbackActive()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(mapOf("error" to "OpenSearch is not the active search engine or cannot be reached"))
        }
        val documentIds = request?.documentIds.orEmpty()
        if (documentIds.isEmpty()) {
            val scheduled = indexCompletenessService.retryAllNextCycle()
            return ResponseEntity.accepted().body(mapOf("scheduled" to scheduled))
        }
        if (documentIds.size > MAX_RETRY_NOW) {
            return ResponseEntity.badRequest()
                .body(mapOf("error" to "Retry at most $MAX_RETRY_NOW cases at once, or retry all of them"))
        }
        val result = reconciler.retry(documentIds)
        return ResponseEntity.ok(
            mapOf("indexed" to result.indexed, "stillRejected" to result.stillRejected, "deleted" to result.deleted)
        )
    }

    data class RetryRequest(val documentIds: List<UUID> = emptyList())

    data class RejectionDto(
        val documentId: UUID,
        val definitionName: String,
        val attempts: Int,
        val firstRejectedOn: LocalDateTime,
        val lastRejectedOn: LocalDateTime,
        val nextRetryOn: LocalDateTime,
    ) {
        companion object {
            fun of(rejection: DocumentIndexRejection) = RejectionDto(
                rejection.documentId,
                rejection.definitionName,
                rejection.attempts,
                rejection.firstRejectedOn,
                rejection.lastRejectedOn,
                rejection.nextRetryOn,
            )
        }
    }

    companion object {
        // A synchronous retry re-indexes each case in the request; "retry all" goes through the reconciler instead.
        const val MAX_RETRY_NOW = 100
    }
}
