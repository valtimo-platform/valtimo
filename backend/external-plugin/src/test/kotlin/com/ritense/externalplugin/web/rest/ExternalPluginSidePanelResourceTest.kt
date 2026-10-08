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

import com.ritense.externalplugin.service.ExternalPluginSidePanelService
import com.ritense.externalplugin.web.rest.dto.ExternalPluginSidePanelDto
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import java.util.UUID

class ExternalPluginSidePanelResourceTest {

    private val sidePanelService: ExternalPluginSidePanelService = mock()
    private val resource = ExternalPluginSidePanelResource(sidePanelService)

    @Test
    fun `returns the resolved side panel`() {
        val configurationId = UUID.randomUUID()
        val sidePanel = ExternalPluginSidePanelDto(
            configurationId = configurationId,
            bundleKey = "evaluatie",
            bundleUrl = "https://pdca:7500/plugins/pdca/0.2.0/bundles/evaluatie-panel.html",
        )
        whenever(sidePanelService.getSidePanel(configurationId, "evaluatie")).thenReturn(sidePanel)

        val response = resource.getSidePanel(configurationId, "evaluatie")

        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body).isEqualTo(sidePanel)
    }

    @Test
    fun `returns 404 when the side panel cannot be resolved`() {
        val configurationId = UUID.randomUUID()
        whenever(sidePanelService.getSidePanel(configurationId, null)).thenReturn(null)

        val response = resource.getSidePanel(configurationId, null)

        assertThat(response.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }
}
