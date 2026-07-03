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

package com.ritense.document.opensearch.service

import com.ritense.document.domain.Document
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.impl.SearchRequest
import com.ritense.valtimo.contract.blueprint.BlueprintType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

class DelegatingDocumentSearchService(
    private val openSearchService: DocumentSearchService,
    private val jpaService: DocumentSearchService,
    private val toggle: SearchEngineToggle,
    private val reindexProgressGate: ReindexProgressGate,
) : DocumentSearchService {

    override fun search(
        searchRequest: SearchRequest,
        blueprintType: BlueprintType,
        pageable: Pageable
    ): Page<out Document> = executeWithFallback { active().search(searchRequest, blueprintType, pageable) }

    override fun search(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        searchWithConfigRequest: SearchWithConfigRequest,
        pageable: Pageable
    ): Page<out Document> = executeWithFallback {
        active().search(documentDefinitionName, blueprintType, searchWithConfigRequest, pageable)
    }

    override fun search(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        advancedSearchRequest: AdvancedSearchRequest,
        pageable: Pageable
    ): Page<out Document> = executeWithFallback {
        active().search(documentDefinitionName, blueprintType, advancedSearchRequest, pageable)
    }

    override fun searchForExport(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        searchWithConfigRequest: SearchWithConfigRequest,
        pageable: Pageable
    ): Page<out Document> = executeWithFallback {
        active().searchForExport(documentDefinitionName, blueprintType, searchWithConfigRequest, pageable)
    }

    override fun count(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        advancedSearchRequest: AdvancedSearchRequest
    ): Long = executeWithFallback { active().count(documentDefinitionName, blueprintType, advancedSearchRequest) }

    private fun active(): DocumentSearchService =
        if (toggle.shouldUsePostgres { reindexProgressGate.isReindexInProgress() }) jpaService else openSearchService

    private fun <T> executeWithFallback(block: () -> T): T {
        if (toggle.shouldUsePostgres { reindexProgressGate.isReindexInProgress() }) {
            return block()
        }
        return try {
            block()
        } catch (e: Exception) {
            if (isConnectionError(e)) {
                toggle.activateFallback()
                block()
            } else {
                throw e
            }
        }
    }

    private fun isConnectionError(e: Exception): Boolean {
        val message = e.message?.lowercase() ?: ""
        return e is java.net.ConnectException ||
            e is java.io.IOException ||
            message.contains("connection refused") ||
            message.contains("connect timed out") ||
            message.contains("no route to host") ||
            e.cause?.let { isConnectionError(it as? Exception ?: return false) } ?: false
    }

}
