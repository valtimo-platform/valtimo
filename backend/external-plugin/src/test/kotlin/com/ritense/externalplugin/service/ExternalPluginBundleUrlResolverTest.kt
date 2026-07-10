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

class ExternalPluginBundleUrlResolverTest {

    private val objectMapper = ObjectMapper()
    private val configurationRepository = mock<ExternalPluginConfigurationRepository>()
    private val definitionRepository = mock<ExternalPluginDefinitionRepository>()
    private val resolver = ExternalPluginBundleUrlResolver(configurationRepository, definitionRepository)

    @Test
    fun `resolves the sole page bundle when no key is given`() {
        val configId = stub(
            """[ { "type":"config", "path":"/bundles/config.html" },
                 { "type":"page", "key":"overview", "path":"/bundles/page.html" } ]"""
        )

        val url = resolver.resolve(configId, "page", null)

        assertThat(url).isEqualTo("http://host:8090/plugins/case-summary/0.1.0/bundles/page.html")
    }

    @Test
    fun `resolves the matching key when several bundles of a type exist`() {
        val configId = stub(
            """[ { "type":"task-form", "key":"approval", "path":"/bundles/approval.html" },
                 { "type":"task-form", "key":"review", "path":"/bundles/review.html" } ]"""
        )

        val url = resolver.resolve(configId, "task-form", "review")

        assertThat(url).isEqualTo("http://host:8090/plugins/case-summary/0.1.0/bundles/review.html")
    }

    @Test
    fun `returns null when no bundle of the requested type exists`() {
        val configId = stub("""[ { "type":"case-tab", "path":"/bundles/case-tab.html" } ]""")

        assertThat(resolver.resolve(configId, "page", null)).isNull()
    }

    @Test
    fun `returns null when the configuration is unknown`() {
        val configId = UUID.randomUUID()
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.empty())

        assertThat(resolver.resolve(configId, "page", null)).isNull()
    }

    private fun stub(bundlesJson: String): UUID {
        val configId = UUID.randomUUID()
        val definitionId = UUID.randomUUID()
        val configuration = ExternalPluginConfiguration(
            id = configId,
            definitionId = definitionId,
            title = "test",
        )
        val manifest = objectMapper.createObjectNode()
            .set<ObjectNode>("frontendBundles", objectMapper.readTree(bundlesJson))
        val definition = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "case-summary",
            version = "0.1.0",
            hostId = UUID.randomUUID(),
            baseUrl = "http://host:8090/plugins/case-summary",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
            manifestJson = manifest,
        )
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.of(configuration))
        whenever(definitionRepository.findById(definitionId)).thenReturn(Optional.of(definition))
        return configId
    }
}
