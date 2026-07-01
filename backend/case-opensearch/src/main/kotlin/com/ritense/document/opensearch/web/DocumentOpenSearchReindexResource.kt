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

import com.ritense.document.opensearch.service.DocumentOpenSearchReindexService
import com.ritense.document.opensearch.service.ReindexRequest
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/management/v1/document-opensearch")
class DocumentOpenSearchReindexResource(
    private val reindexService: DocumentOpenSearchReindexService,
) {

    @PostMapping("/reindex")
    fun reindex(@RequestBody(required = false) request: ReindexRequest?): ResponseEntity<Map<String, Any?>> {
        val runId = reindexService.start(request ?: ReindexRequest())
            ?: return ResponseEntity.status(409).body(mapOf("error" to "Re-index already in progress"))
        return ResponseEntity.accepted().body(mapOf("status" to "started", "runId" to runId))
    }

    @GetMapping("/reindex/status")
    fun status(): ResponseEntity<Map<String, Any?>> = ResponseEntity.ok(reindexService.status())

    @GetMapping("/reindex/{runId}")
    fun statusById(@PathVariable runId: UUID): ResponseEntity<Map<String, Any?>> =
        ResponseEntity.ok(reindexService.status(runId))
}
