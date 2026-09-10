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

class ExternalPluginMenuPageServiceTest {

    private val objectMapper = ObjectMapper()
    private val configurationRepository = mock<ExternalPluginConfigurationRepository>()
    private val definitionRepository = mock<ExternalPluginDefinitionRepository>()
    private val bundleUrlResolver = ExternalPluginBundleUrlResolver(configurationRepository, definitionRepository)
    private val service = ExternalPluginMenuPageService(configurationRepository, definitionRepository, bundleUrlResolver)

    @Test
    fun `lists only page bundles of available configurations with resolved url and localized title`() {
        val availableConfigId = UUID.randomUUID()
        val availableDefId = UUID.randomUUID()
        val available = configuration(availableConfigId, availableDefId, "Overview config")
        val availableDef = definition(
            availableDefId,
            ExternalPluginDefinitionStatus.AVAILABLE,
            bundlesJson = """[ { "type":"config", "path":"/bundles/config.html" },
                               { "type":"page", "key":"overview", "title":"page.overview.title", "icon":"home", "path":"/bundles/page.html" } ]""",
            translationsJson = """{ "en": { "page.overview.title": "Overview" }, "nl": { "page.overview.title": "Overzicht" } }""",
        )

        val unavailableConfigId = UUID.randomUUID()
        val unavailableDefId = UUID.randomUUID()
        val unavailable = configuration(unavailableConfigId, unavailableDefId, "Hidden config")
        val unavailableDef = definition(
            unavailableDefId,
            ExternalPluginDefinitionStatus.UNAVAILABLE,
            bundlesJson = """[ { "type":"page", "key":"overview", "path":"/bundles/page.html" } ]""",
        )

        whenever(configurationRepository.findAll()).thenReturn(listOf(available, unavailable))
        whenever(configurationRepository.findById(availableConfigId)).thenReturn(Optional.of(available))
        whenever(configurationRepository.findById(unavailableConfigId)).thenReturn(Optional.of(unavailable))
        whenever(definitionRepository.findById(availableDefId)).thenReturn(Optional.of(availableDef))
        whenever(definitionRepository.findById(unavailableDefId)).thenReturn(Optional.of(unavailableDef))

        val pages = service.getMenuPages()

        assertThat(pages).hasSize(1)
        val page = pages.single()
        assertThat(page.configurationId).isEqualTo(availableConfigId)
        assertThat(page.bundleKey).isEqualTo("overview")
        assertThat(page.bundleUrl).isEqualTo("http://host:8090/plugins/case-summary/0.1.0/bundles/page.html")
        assertThat(page.title).isEqualTo("page.overview.title")
        assertThat(page.icon).isEqualTo("home")
        assertThat(page.titleTranslations).containsEntry("en", "Overview").containsEntry("nl", "Overzicht")
    }

    @Test
    fun `returns empty when an available configuration has no page bundles`() {
        val configId = UUID.randomUUID()
        val defId = UUID.randomUUID()
        val config = configuration(configId, defId, "Config")
        val def = definition(
            defId,
            ExternalPluginDefinitionStatus.AVAILABLE,
            bundlesJson = """[ { "type":"case-tab", "key":"summary", "path":"/bundles/case-tab.html" } ]""",
        )
        whenever(configurationRepository.findAll()).thenReturn(listOf(config))
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.of(config))
        whenever(definitionRepository.findById(defId)).thenReturn(Optional.of(def))

        assertThat(service.getMenuPages()).isEmpty()
    }

    private fun configuration(id: UUID, definitionId: UUID, title: String) =
        ExternalPluginConfiguration(id = id, definitionId = definitionId, title = title)

    private fun definition(
        id: UUID,
        status: ExternalPluginDefinitionStatus,
        bundlesJson: String,
        translationsJson: String? = null,
    ): ExternalPluginDefinition {
        val manifest = objectMapper.createObjectNode()
            .set<ObjectNode>("frontendBundles", objectMapper.readTree(bundlesJson))
        if (translationsJson != null) {
            manifest.set<ObjectNode>("translations", objectMapper.readTree(translationsJson))
        }
        return ExternalPluginDefinition(
            id = id,
            pluginId = "case-summary",
            version = "0.1.0",
            hostId = UUID.randomUUID(),
            baseUrl = "http://host:8090/plugins/case-summary",
            status = status,
            manifestJson = manifest,
        )
    }
}
