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

package com.ritense.case_.rest

import com.ritense.case_.rest.dto.ExternalPluginTabContentDto
import com.ritense.case_.rest.dto.ExternalPluginTabContext
import com.ritense.case_.service.CaseExternalPluginTabService
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import java.util.UUID

/**
 * The case-tab content endpoint. Its job is narrow but load-bearing: hand the frontend
 * wrapper the bundle URL and the case context, and answer 404 rather than an empty 200 when the tab
 * or document is unknown — the wrapper branches on that. The PBAC check lives in the service and must
 * propagate, never be swallowed into a 200.
 */
class CaseExternalPluginTabResourceTest {

    private val service: CaseExternalPluginTabService = mock()
    private val resource = CaseExternalPluginTabResource(service)

    private val documentId: UUID = UUID.randomUUID()
    private val configurationId: UUID = UUID.randomUUID()

    private fun content(bundleUrl: String?, bundleKey: String? = "overview") = ExternalPluginTabContentDto(
        bundleUrl = bundleUrl,
        configurationId = configurationId,
        bundleKey = bundleKey,
        context = ExternalPluginTabContext(
            documentId = documentId.toString(),
            caseDefinitionKey = "my-case",
            caseDefinitionVersionTag = "1.0.0",
            pluginConfigurationId = configurationId.toString(),
        ),
    )

    @Test
    fun `returns the bundle url, configuration and case context for a known tab`() {
        whenever(service.getExternalPluginTab(documentId, "summary")).thenReturn(
            content("https://plugin-host:8090/plugins/case-summary/0.1.0/frontend/case-tab.html")
        )

        val response = resource.getExternalPluginTab(documentId, "summary")

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        val body = response.body!!
        assertThat(body.bundleUrl)
            .isEqualTo("https://plugin-host:8090/plugins/case-summary/0.1.0/frontend/case-tab.html")
        assertThat(body.configurationId).isEqualTo(configurationId)
        assertThat(body.bundleKey).isEqualTo("overview")
        assertThat(body.context.documentId).isEqualTo(documentId.toString())
        assertThat(body.context.caseDefinitionKey).isEqualTo("my-case")
        assertThat(body.context.caseDefinitionVersionTag).isEqualTo("1.0.0")
        assertThat(body.context.pluginConfigurationId).isEqualTo(configurationId.toString())
    }

    @Test
    fun `carries a null bundle url when the resolver is absent or the configuration is dangling`() {
        // `case` consumes the bundle resolver as an Optional so it builds without external-plugin; the
        // frontend renders an unavailable state instead of an iframe.
        whenever(service.getExternalPluginTab(documentId, "summary")).thenReturn(content(null))

        val response = resource.getExternalPluginTab(documentId, "summary")

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body!!.bundleUrl).isNull()
        assertThat(response.body!!.configurationId).isEqualTo(configurationId)
    }

    @Test
    fun `answers 404 for an unknown tab key rather than an empty 200`() {
        whenever(service.getExternalPluginTab(documentId, "nope")).thenReturn(null)

        val response = resource.getExternalPluginTab(documentId, "nope")

        assertThat(response.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
        assertThat(response.body).isNull()
    }

    @Test
    fun `answers 404 for an unknown document`() {
        val unknownDocument = UUID.randomUUID()
        whenever(service.getExternalPluginTab(unknownDocument, "summary")).thenReturn(null)

        assertThat(resource.getExternalPluginTab(unknownDocument, "summary").statusCode)
            .isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `propagates the service's PBAC denial instead of degrading to a 200`() {
        whenever(service.getExternalPluginTab(documentId, "summary"))
            .thenThrow(RuntimeException("Unauthorized to view this case tab"))

        assertThatThrownBy { resource.getExternalPluginTab(documentId, "summary") }
            .hasMessageContaining("Unauthorized")
    }

    @Test
    fun `passes the path variables through unchanged — the tab key is not normalised`() {
        whenever(service.getExternalPluginTab(eq(documentId), eq("Summary-Tab_1")))
            .thenReturn(content("https://host/bundle.html"))

        resource.getExternalPluginTab(documentId, "Summary-Tab_1")

        verify(service).getExternalPluginTab(documentId, "Summary-Tab_1")
    }
}
