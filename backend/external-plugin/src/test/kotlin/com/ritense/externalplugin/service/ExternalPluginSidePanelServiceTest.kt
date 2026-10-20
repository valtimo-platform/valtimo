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

package com.ritense.externalplugin.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

class ExternalPluginSidePanelServiceTest {

    private val objectMapper = ObjectMapper()
    private val configurationRepository = mock<ExternalPluginConfigurationRepository>()
    private val definitionRepository = mock<ExternalPluginDefinitionRepository>()
    private val bundleUrlResolver = ExternalPluginBundleUrlResolver(configurationRepository, definitionRepository)
    private val service = ExternalPluginSidePanelService(configurationRepository, definitionRepository, bundleUrlResolver)

    private val configurationId = UUID.randomUUID()
    private val definitionId = UUID.randomUUID()

    @Test
    fun `resolves the side-panel bundle by key`() {
        givenDefinition(
            ExternalPluginDefinitionStatus.AVAILABLE,
            """[ { "type":"case-tab", "key":"evaluatie", "path":"/bundles/tab.html" },
                 { "type":"side-panel", "key":"evaluatie", "path":"/bundles/panel.html" } ]""",
        )

        val sidePanel = service.getSidePanel(configurationId, "evaluatie")

        assertThat(sidePanel).isNotNull
        assertThat(sidePanel!!.configurationId).isEqualTo(configurationId)
        assertThat(sidePanel.bundleKey).isEqualTo("evaluatie")
        assertThat(sidePanel.bundleUrl).isEqualTo("http://host:8090/plugins/pdca/0.2.0/bundles/panel.html")
    }

    @Test
    fun `does not resolve a bundle of another type`() {
        givenDefinition(
            ExternalPluginDefinitionStatus.AVAILABLE,
            """[ { "type":"page", "key":"evaluatie", "path":"/bundles/page.html" } ]""",
        )

        assertThat(service.getSidePanel(configurationId, "evaluatie")).isNull()
    }

    @Test
    fun `does not resolve for an unavailable definition`() {
        givenDefinition(
            ExternalPluginDefinitionStatus.UNAVAILABLE,
            """[ { "type":"side-panel", "key":"evaluatie", "path":"/bundles/panel.html" } ]""",
        )

        assertThat(service.getSidePanel(configurationId, "evaluatie")).isNull()
    }

    @Test
    fun `does not resolve an unknown configuration`() {
        whenever(configurationRepository.findById(configurationId)).thenReturn(Optional.empty())

        assertThat(service.getSidePanel(configurationId, null)).isNull()
    }

    private fun givenDefinition(status: ExternalPluginDefinitionStatus, bundlesJson: String) {
        val configuration = ExternalPluginConfiguration(id = configurationId, definitionId = definitionId, title = "PDCA")
        val definition = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "pdca",
            version = "0.2.0",
            hostId = UUID.randomUUID(),
            baseUrl = "http://host:8090/plugins/pdca",
            status = status,
            manifestJson = objectMapper.createObjectNode()
                .set<ObjectNode>("frontendBundles", objectMapper.readTree(bundlesJson)),
        )
        whenever(configurationRepository.findById(configurationId)).thenReturn(Optional.of(configuration))
        whenever(definitionRepository.findById(definitionId)).thenReturn(Optional.of(definition))
    }
}
