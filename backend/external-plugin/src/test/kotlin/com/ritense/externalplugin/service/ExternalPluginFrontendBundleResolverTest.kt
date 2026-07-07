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

class ExternalPluginFrontendBundleResolverTest {

    private val objectMapper = ObjectMapper()
    private val configurationRepository = mock<ExternalPluginConfigurationRepository>()
    private val definitionRepository = mock<ExternalPluginDefinitionRepository>()
    private val resolver = ExternalPluginFrontendBundleResolver(configurationRepository, definitionRepository)

    @Test
    fun `resolves the sole task-form bundle when no key is given`() {
        val configId = stub(
            """[ { "type":"config", "path":"/bundles/config.html" },
                 { "type":"task-form", "key":"review", "path":"/bundles/task-form.html" } ]"""
        )

        val url = resolver.resolveBundleUrl(configId, "task-form", null)

        assertThat(url).isEqualTo("http://host:8090/plugins/case-summary/0.1.0/bundles/task-form.html")
    }

    @Test
    fun `resolves the matching task-form bundle by key when several exist`() {
        val configId = stub(
            """[ { "type":"task-form", "key":"review", "path":"/bundles/review.html" },
                 { "type":"task-form", "key":"approve", "path":"/bundles/approve.html" } ]"""
        )

        val url = resolver.resolveBundleUrl(configId, "task-form", "approve")

        assertThat(url).isEqualTo("http://host:8090/plugins/case-summary/0.1.0/bundles/approve.html")
    }

    @Test
    fun `resolves each type independently from the same manifest`() {
        val configId = stub(
            """[ { "type":"case-tab", "key":"summary", "path":"/bundles/case-tab.html" },
                 { "type":"task-form", "key":"review", "path":"/bundles/task-form.html" } ]"""
        )

        assertThat(resolver.resolveBundleUrl(configId, "task-form", null))
            .isEqualTo("http://host:8090/plugins/case-summary/0.1.0/bundles/task-form.html")
        assertThat(resolver.resolveBundleUrl(configId, "case-tab", null))
            .isEqualTo("http://host:8090/plugins/case-summary/0.1.0/bundles/case-tab.html")
    }

    @Test
    fun `returns null when there is no bundle of the requested type`() {
        val configId = stub("""[ { "type":"case-tab", "key":"summary", "path":"/bundles/case-tab.html" } ]""")

        assertThat(resolver.resolveBundleUrl(configId, "task-form", null)).isNull()
    }

    @Test
    fun `returns null when the configuration is unknown`() {
        val configId = UUID.randomUUID()
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.empty())

        assertThat(resolver.resolveBundleUrl(configId, "task-form", null)).isNull()
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
