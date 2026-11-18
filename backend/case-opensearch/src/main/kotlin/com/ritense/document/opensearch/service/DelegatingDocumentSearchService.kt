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

import com.ritense.document.domain.Document
import com.ritense.document.domain.search.AdvancedSearchRequest
import com.ritense.document.domain.search.SearchWithConfigRequest
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.GlobalSearchFieldMeta
import com.ritense.document.service.impl.SearchRequest
import com.ritense.valtimo.contract.blueprint.BlueprintType
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class DelegatingDocumentSearchService(
    private val openSearchService: DocumentSearchService,
    private val jpaService: DocumentSearchService,
    private val toggle: SearchEngineToggle,
    private val reindexProgressGate: ReindexProgressGate,
    private val topologyGate: TopologyGate,
) : DocumentSearchService {

    override fun search(
        searchRequest: SearchRequest,
        blueprintType: BlueprintType,
        pageable: Pageable
    ): Page<out Document> = route(listOfNotNull(searchRequest.documentDefinitionName?.takeIf { it.isNotEmpty() })) {
        it.search(searchRequest, blueprintType, pageable)
    }

    override fun search(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        searchWithConfigRequest: SearchWithConfigRequest,
        pageable: Pageable
    ): Page<out Document> = route(definition(documentDefinitionName)) {
        it.search(documentDefinitionName, blueprintType, searchWithConfigRequest, pageable)
    }

    override fun search(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        advancedSearchRequest: AdvancedSearchRequest,
        pageable: Pageable
    ): Page<out Document> = route(definition(documentDefinitionName)) {
        it.search(documentDefinitionName, blueprintType, advancedSearchRequest, pageable)
    }

    override fun searchForExport(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        searchWithConfigRequest: SearchWithConfigRequest,
        pageable: Pageable
    ): Page<out Document> = route(definition(documentDefinitionName)) {
        it.searchForExport(documentDefinitionName, blueprintType, searchWithConfigRequest, pageable)
    }

    override fun search(
        documentDefinitionNames: Collection<String>,
        blueprintType: BlueprintType,
        searchWithConfigRequest: SearchWithConfigRequest,
        pageable: Pageable
    ): Page<out Document> = route(documentDefinitionNames) {
        it.search(documentDefinitionNames, blueprintType, searchWithConfigRequest, pageable)
    }

    override fun search(
        documentDefinitionNames: Collection<String>,
        blueprintType: BlueprintType,
        searchWithConfigRequest: SearchWithConfigRequest,
        filterPathMappings: Map<String, Map<String, String>>,
        pageable: Pageable
    ): Page<out Document> = route(documentDefinitionNames) {
        it.search(documentDefinitionNames, blueprintType, searchWithConfigRequest, filterPathMappings, pageable)
    }

    override fun search(
        documentDefinitionNames: Collection<String>,
        blueprintType: BlueprintType,
        searchWithConfigRequest: SearchWithConfigRequest,
        filterPathMappings: Map<String, Map<String, String>>,
        globalSearchFields: Map<String, GlobalSearchFieldMeta>,
        pageable: Pageable
    ): Page<out Document> = route(documentDefinitionNames) {
        it.search(documentDefinitionNames, blueprintType, searchWithConfigRequest, filterPathMappings, globalSearchFields, pageable)
    }

    override fun count(
        documentDefinitionName: String,
        blueprintType: BlueprintType,
        advancedSearchRequest: AdvancedSearchRequest
    ): Long = route(definition(documentDefinitionName)) {
        it.count(documentDefinitionName, blueprintType, advancedSearchRequest)
    }

    private fun definition(documentDefinitionName: String): List<String> =
        listOfNotNull(documentDefinitionName.takeIf { it.isNotEmpty() })

    private fun <T> route(definitionNames: Collection<String>, search: (DocumentSearchService) -> T): T {
        if (shouldUsePostgres(definitionNames)) {
            return search(jpaService)
        }
        return try {
            search(openSearchService)
        } catch (e: Exception) {
            if (!isConnectionError(e)) throw e
            toggle.activateFallback()
            search(jpaService)
        }
    }

    // While a reindex is RUNNING, or OpenSearch cannot list every case of these definitions, route to PostgreSQL.
    private fun shouldUsePostgres(definitionNames: Collection<String>): Boolean =
        toggle.shouldUsePostgres { reindexProgressGate.isReindexInProgress() || mustUseDatabase(definitionNames) }

    private fun mustUseDatabase(definitionNames: Collection<String>): Boolean =
        try {
            topologyGate.mustUseDatabase(definitionNames)
        } catch (e: Exception) {
            if (isConnectionError(e)) {
                toggle.activateFallback()
            } else {
                logger.warn(e) { "Could not determine whether OpenSearch can serve document search — using PostgreSQL" }
            }
            true
        }

    private fun isConnectionError(e: Throwable): Boolean {
        val message = e.message?.lowercase() ?: ""
        return e is ConnectException ||
            e is SocketTimeoutException ||
            e is NoRouteToHostException ||
            e is UnknownHostException ||
            message.contains("connection refused") ||
            message.contains("connect timed out") ||
            message.contains("no route to host") ||
            e.cause?.let { isConnectionError(it) } ?: false
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
