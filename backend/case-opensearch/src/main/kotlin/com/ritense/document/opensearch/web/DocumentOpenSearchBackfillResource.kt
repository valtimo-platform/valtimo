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

package com.ritense.document.opensearch.web

import com.ritense.document.opensearch.service.DocumentOpenSearchBackfillService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/management/v1/document-opensearch")
class DocumentOpenSearchBackfillResource(
    private val backfillService: DocumentOpenSearchBackfillService,
) {

    /**
     * Triggers a full backfill of all [com.ritense.document.domain.impl.JsonSchemaDocument]
     * records to the OpenSearch read model.
     *
     * Only accessible to users with ROLE_ADMIN.
     */
    @PostMapping("/backfill")
    fun backfill(
        @RequestParam(defaultValue = "${DocumentOpenSearchBackfillService.DEFAULT_PAGE_SIZE}") pageSize: Int,
    ): ResponseEntity<Map<String, Long>> {
        val count = backfillService.backfill(pageSize)
        return ResponseEntity.ok(mapOf("migratedCount" to count))
    }
}
