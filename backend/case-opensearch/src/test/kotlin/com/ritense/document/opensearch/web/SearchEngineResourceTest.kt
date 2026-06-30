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
import com.ritense.adminsettings.web.rest.dto.FeatureToggleOverridesDto
import com.ritense.document.opensearch.OpenSearchProperties
import com.ritense.document.opensearch.service.SearchEngineToggle
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus

class SearchEngineResourceTest {

    private lateinit var toggle: SearchEngineToggle
    private lateinit var properties: OpenSearchProperties
    private lateinit var featureToggleService: FeatureToggleOverridesService
    private lateinit var resource: SearchEngineResource

    @BeforeEach
    fun setUp() {
        toggle = SearchEngineToggle()
        properties = OpenSearchProperties(enabled = true)
        featureToggleService = mock()
        resource = SearchEngineResource(toggle, properties, featureToggleService)
    }

    @Test
    fun `getActive returns available true and current engine when OpenSearch enabled`() {
        toggle.set(SearchEngineToggle.Engine.OPENSEARCH)

        val response = resource.getActive()

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body?.available).isTrue()
        assertThat(response.body?.active).isEqualTo("OPENSEARCH")
    }

    @Test
    fun `getActive returns available false when OpenSearch disabled`() {
        val disabledResource = SearchEngineResource(
            toggle,
            OpenSearchProperties(enabled = false),
            featureToggleService
        )

        val response = disabledResource.getActive()

        assertThat(response.body?.available).isFalse()
    }

    @Test
    fun `setActive updates toggle and persists to feature toggles`() {
        whenever(featureToggleService.updateToggle(any(), any()))
            .thenReturn(FeatureToggleOverridesDto(mapOf("useOpenSearchForDocumentSearch" to false)))

        val response = resource.setActive(SearchEngineResource.UpdateSearchEngineDto("POSTGRES"))

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body?.active).isEqualTo("POSTGRES")
        assertThat(toggle.get()).isEqualTo(SearchEngineToggle.Engine.POSTGRES)
        verify(featureToggleService).updateToggle(eq("useOpenSearchForDocumentSearch"), eq(false))
    }

    @Test
    fun `setActive to OPENSEARCH persists true`() {
        toggle.set(SearchEngineToggle.Engine.POSTGRES)
        whenever(featureToggleService.updateToggle(any(), any()))
            .thenReturn(FeatureToggleOverridesDto(mapOf("useOpenSearchForDocumentSearch" to true)))

        val response = resource.setActive(SearchEngineResource.UpdateSearchEngineDto("OPENSEARCH"))

        assertThat(response.body?.active).isEqualTo("OPENSEARCH")
        assertThat(toggle.get()).isEqualTo(SearchEngineToggle.Engine.OPENSEARCH)
        verify(featureToggleService).updateToggle(eq("useOpenSearchForDocumentSearch"), eq(true))
    }

    @Test
    fun `setActive returns bad request when OpenSearch disabled`() {
        val disabledResource = SearchEngineResource(
            toggle,
            OpenSearchProperties(enabled = false),
            featureToggleService
        )

        val response = disabledResource.setActive(SearchEngineResource.UpdateSearchEngineDto("OPENSEARCH"))

        assertThat(response.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }
}
