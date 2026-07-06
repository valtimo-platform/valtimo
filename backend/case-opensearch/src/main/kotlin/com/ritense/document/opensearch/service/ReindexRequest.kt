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

package com.ritense.document.opensearch.service

import java.time.LocalDateTime
import java.util.UUID

/**
 * Describes the scope of a re-index run. All filters are optional; an empty request re-indexes every
 * [com.ritense.document.domain.impl.JsonSchemaDocument] into the live `json_schema_document` index.
 *
 * @param modifiedAfter only documents with `modifiedOn` strictly after this instant
 * @param modifiedBefore only documents with `modifiedOn` strictly before this instant
 * @param documentDefinitionName only documents of this document-definition name
 * @param documentIds explicit subset of document ids
 * @param pageSize DB keyset page size, clamped to [1, MAX_PAGE_SIZE] by [effectivePageSize]
 * @param resumeRunId continue a prior (FAILED/STOPPED) run from its persisted cursor instead of starting fresh
 */
data class ReindexRequest(
    val modifiedAfter: LocalDateTime? = null,
    val modifiedBefore: LocalDateTime? = null,
    val documentDefinitionName: String? = null,
    val documentIds: List<UUID>? = null,
    val pageSize: Int = DEFAULT_PAGE_SIZE,
    val resumeRunId: UUID? = null,
) {
    fun effectivePageSize() = pageSize.coerceIn(1, MAX_PAGE_SIZE)

    companion object {
        const val DEFAULT_PAGE_SIZE = 5000
        const val MAX_PAGE_SIZE = 10_000
    }
}
