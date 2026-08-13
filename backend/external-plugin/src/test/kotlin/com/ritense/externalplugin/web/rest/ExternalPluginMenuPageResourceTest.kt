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

package com.ritense.externalplugin.web.rest

import com.ritense.externalplugin.service.ExternalPluginMenuPageService
import com.ritense.externalplugin.web.rest.dto.ExternalPluginMenuPageDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import java.util.UUID

/**
 * The menu-page listing the menu-configuration builder reads (plan §13). Access to the page's actual
 * data is enforced at render time by PBAC ∩ the configuration's allowlist through the downscoped user
 * token, so this list is intentionally unfiltered — the resource must not invent its own filtering.
 */
class ExternalPluginMenuPageResourceTest {

    private val menuPageService: ExternalPluginMenuPageService = mock()
    private val resource = ExternalPluginMenuPageResource(menuPageService)

    private fun page(title: String) = ExternalPluginMenuPageDto(
        configurationId = UUID.randomUUID(),
        configurationTitle = "My configuration",
        bundleKey = "dashboard",
        bundleUrl = "https://plugin-host:8090/plugins/case-summary/0.1.0/frontend/page.html",
        title = title,
        titleTranslations = mapOf("en" to title, "nl" to "Overzicht"),
        icon = "chart",
    )

    @Test
    fun `returns the service's pages verbatim`() {
        val pages = listOf(page("Overview"), page("Reports"))
        whenever(menuPageService.getMenuPages()).thenReturn(pages)

        val response = resource.getMenuPages()

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body).isEqualTo(pages)
    }

    @Test
    fun `carries the bundle url and localised titles the builder renders`() {
        whenever(menuPageService.getMenuPages()).thenReturn(listOf(page("Overview")))

        val body = resource.getMenuPages().body!!.single()

        assertThat(body.bundleUrl)
            .isEqualTo("https://plugin-host:8090/plugins/case-summary/0.1.0/frontend/page.html")
        assertThat(body.titleTranslations).containsEntry("nl", "Overzicht")
        assertThat(body.bundleKey).isEqualTo("dashboard")
    }

    @Test
    fun `returns an empty list when no activated configuration exposes a page bundle`() {
        whenever(menuPageService.getMenuPages()).thenReturn(emptyList())

        val response = resource.getMenuPages()

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body).isEmpty()
    }
}
