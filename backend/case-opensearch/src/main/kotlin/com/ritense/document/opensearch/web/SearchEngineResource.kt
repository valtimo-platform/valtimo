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

import com.ritense.adminsettings.service.FeatureToggleOverridesService
import com.ritense.document.opensearch.OpenSearchProperties
import com.ritense.document.opensearch.autoconfigure.DocumentOpenSearchAutoConfiguration.Companion.SEARCH_ENGINE_TOGGLE_KEY
import com.ritense.document.opensearch.service.DocumentOpenSearchIndexInitializer
import com.ritense.document.opensearch.service.SearchEngineToggle
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/management/v1/search-engine")
class SearchEngineResource(
    private val toggle: SearchEngineToggle,
    private val openSearchProperties: OpenSearchProperties,
    private val featureToggleOverridesService: FeatureToggleOverridesService,
    private val indexInitializer: DocumentOpenSearchIndexInitializer,
) {

    @EndpointDescription(
        en = "Get active search engine",
        nl = "Actieve zoekmachine ophalen",
    )
    @GetMapping
    fun getActive(): ResponseEntity<SearchEngineDto> =
        ResponseEntity.ok(
            SearchEngineDto(
                available = openSearchProperties.enabled,
                active = toggle.get().name
            )
        )

    @EndpointDescription(
        en = "Set active search engine",
        nl = "Actieve zoekmachine instellen",
    )
    @PutMapping
    fun setActive(@RequestBody body: UpdateSearchEngineDto): ResponseEntity<SearchEngineDto> {
        if (!openSearchProperties.enabled) {
            return ResponseEntity.badRequest().build()
        }

        val useOpenSearch = body.active.uppercase() == "OPENSEARCH"

        if (useOpenSearch) {
            try {
                indexInitializer.ensureIndex()
            } catch (e: Exception) {
                logger.warn(e) { "Failed to initialize OpenSearch index — is OpenSearch running?" }
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(SearchEngineDto(available = true, active = toggle.get().name))
            }
        }

        featureToggleOverridesService.updateToggle(SEARCH_ENGINE_TOGGLE_KEY, useOpenSearch)

        val engine = if (useOpenSearch) SearchEngineToggle.Engine.OPENSEARCH else SearchEngineToggle.Engine.POSTGRES
        toggle.set(engine)

        return ResponseEntity.ok(
            SearchEngineDto(
                available = true,
                active = toggle.get().name
            )
        )
    }

    data class SearchEngineDto(
        val available: Boolean,
        val active: String
    )

    data class UpdateSearchEngineDto(
        val active: String
    )

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
