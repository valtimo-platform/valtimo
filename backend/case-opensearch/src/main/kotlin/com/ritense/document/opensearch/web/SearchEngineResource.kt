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

import com.ritense.adminsettings.service.FeatureToggleOverridesService
import com.ritense.document.opensearch.OpenSearchProperties
import com.ritense.document.opensearch.autoconfigure.DocumentOpenSearchAutoConfiguration.Companion.SEARCH_ENGINE_TOGGLE_KEY
import com.ritense.document.opensearch.service.SearchEngineToggle
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
) {

    @GetMapping
    fun getActive(): ResponseEntity<SearchEngineDto> =
        ResponseEntity.ok(
            SearchEngineDto(
                available = openSearchProperties.enabled,
                active = toggle.get().name
            )
        )

    @PutMapping
    fun setActive(@RequestBody body: UpdateSearchEngineDto): ResponseEntity<SearchEngineDto> {
        if (!openSearchProperties.enabled) {
            return ResponseEntity.badRequest().build()
        }

        val useOpenSearch = body.active.uppercase() == "OPENSEARCH"
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
}
