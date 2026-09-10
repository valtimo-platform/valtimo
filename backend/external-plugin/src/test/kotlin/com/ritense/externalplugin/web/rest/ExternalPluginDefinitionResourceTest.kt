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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.compatibility.GzacCompatibilityChecker
import com.ritense.externalplugin.compatibility.PluginPackageInspector
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.service.EndpointDescriptionService
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginDiscoveryService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.externalplugin.web.rest.dto.AcceptContentRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.mock.env.MockEnvironment
import java.util.UUID

/**
 * Definition-facing endpoints of the management resource: the compatibility verdict folded into the
 * response (informational, never blocking), the `requiresReacceptance` flag that makes a
 * changed package visible to the admin, the logo URL the UI renders, and the API-only content
 * re-acceptance recovery path.
 */
class ExternalPluginDefinitionResourceTest {

    private lateinit var definitionService: ExternalPluginDefinitionService
    private lateinit var discoveryService: ExternalPluginDiscoveryService
    private var currentGzacVersion: String? = "12.0.5"

    private val definitionId = UUID.randomUUID()
    private val hostId = UUID.randomUUID()
    private val objectMapper = ObjectMapper()

    private lateinit var resource: ExternalPluginManagementResource

    @BeforeEach
    fun setUp() {
        definitionService = mock()
        discoveryService = mock()
        currentGzacVersion = "12.0.5"
        resource = ExternalPluginManagementResource(
            hostService = mock<ExternalPluginHostService>(),
            definitionService = definitionService,
            configurationService = mock<ExternalPluginConfigurationService>(),
            hostClient = mock<ExternalPluginHostClient>(),
            endpointDescriptionService = mock<EndpointDescriptionService>(),
            discoveryService = discoveryService,
            environment = MockEnvironment(),
            compatibilityChecker = GzacCompatibilityChecker { currentGzacVersion },
            pluginPackageInspector = PluginPackageInspector(objectMapper),
            objectMapper = objectMapper,
        )
    }

    private fun manifest(withLogo: Boolean): ObjectNode = objectMapper.createObjectNode().apply {
        put("pluginId", "case-summary")
        put("version", "0.1.0")
        if (withLogo) put("logo", "logo.svg")
    }

    private fun definition(
        minGzacVersion: String? = null,
        maxGzacVersion: String? = null,
        contentHash: String? = "sha256:accepted",
        pendingContentHash: String? = null,
        withLogo: Boolean = false,
    ) = ExternalPluginDefinition(
        id = definitionId,
        pluginId = "case-summary",
        version = "0.1.0",
        name = "Case Summary",
        description = "Shows a summary",
        provider = "Ritense",
        minGzacVersion = minGzacVersion,
        maxGzacVersion = maxGzacVersion,
        manifestJson = manifest(withLogo),
        hostId = hostId,
        baseUrl = "https://plugin-host:8090/plugins/case-summary",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
        contentHash = contentHash,
        pendingContentHash = pendingContentHash,
    )

    // ---------------------------------------------------------------- compatibility folding

    @Test
    fun `getDefinition reports compatible for a definition targeting the running version`() {
        whenever(definitionService.get(definitionId)).thenReturn(
            definition(minGzacVersion = "12.0.0", maxGzacVersion = "12.1.0")
        )

        val body = resource.getDefinition(definitionId).body!!

        assertThat(body.compatible).isTrue()
        assertThat(body.currentGzacVersion).isEqualTo("12.0.5")
        assertThat(body.minGzacVersion).isEqualTo("12.0.0")
        assertThat(body.maxGzacVersion).isEqualTo("12.1.0")
    }

    @Test
    fun `getDefinition reports incompatible below the declared minimum but still returns the definition`() {
        whenever(definitionService.get(definitionId)).thenReturn(definition(minGzacVersion = "13.0.0"))

        val body = resource.getDefinition(definitionId).body!!

        // Informational only — an incompatible definition still lists and can still be activated.
        assertThat(body.compatible).isFalse()
        assertThat(body.id).isEqualTo(definitionId)
        assertThat(body.status).isEqualTo(ExternalPluginDefinitionStatus.AVAILABLE)
    }

    @Test
    fun `getDefinition reports incompatible above the declared maximum`() {
        whenever(definitionService.get(definitionId)).thenReturn(definition(maxGzacVersion = "11.9.0"))

        assertThat(resource.getDefinition(definitionId).body!!.compatible).isFalse()
    }

    @Test
    fun `getDefinition does not warn when the running version cannot be determined`() {
        currentGzacVersion = null
        whenever(definitionService.get(definitionId)).thenReturn(definition(minGzacVersion = "13.0.0"))

        val body = resource.getDefinition(definitionId).body!!

        assertThat(body.compatible).isTrue()
        assertThat(body.currentGzacVersion).isNull()
    }

    @Test
    fun `listDefinitions folds the verdict into every row`() {
        whenever(definitionService.list()).thenReturn(
            listOf(definition(minGzacVersion = "12.0.0"), definition(minGzacVersion = "13.0.0"))
        )

        assertThat(resource.listDefinitions().body!!.map { it.compatible })
            .containsExactly(true, false)
    }

    // ---------------------------------------------------------------- logo url

    @Test
    fun `getDefinition composes an absolute logo url when the manifest declares one`() {
        whenever(definitionService.get(definitionId)).thenReturn(definition(withLogo = true))

        assertThat(resource.getDefinition(definitionId).body!!.logoUrl)
            .isEqualTo("https://plugin-host:8090/plugins/case-summary/0.1.0/logo")
    }

    @Test
    fun `getDefinition exposes no logo url when the plugin shipped none`() {
        whenever(definitionService.get(definitionId)).thenReturn(definition(withLogo = false))

        assertThat(resource.getDefinition(definitionId).body!!.logoUrl).isNull()
    }

    // ---------------------------------------------------------------- content pinning

    @Test
    fun `getDefinition flags a changed package for re-acceptance and exposes both hashes`() {
        whenever(definitionService.get(definitionId)).thenReturn(
            definition(contentHash = "sha256:accepted", pendingContentHash = "sha256:changed")
        )

        val body = resource.getDefinition(definitionId).body!!

        assertThat(body.requiresReacceptance).isTrue()
        assertThat(body.contentHash).isEqualTo("sha256:accepted")
        assertThat(body.pendingContentHash).isEqualTo("sha256:changed")
    }

    @Test
    fun `getDefinition does not flag a definition whose package still matches the pin`() {
        whenever(definitionService.get(definitionId)).thenReturn(definition(pendingContentHash = null))

        val body = resource.getDefinition(definitionId).body!!

        assertThat(body.requiresReacceptance).isFalse()
        assertThat(body.pendingContentHash).isNull()
    }

    @Test
    fun `acceptDefinitionContent forwards the reviewed hash and re-discovers before responding`() {
        val accepted = definition(contentHash = "sha256:changed", pendingContentHash = null)
        whenever(definitionService.acceptContent(definitionId, "sha256:changed")).thenReturn(accepted)
        whenever(definitionService.get(definitionId)).thenReturn(accepted)

        val body = resource.acceptDefinitionContent(
            definitionId,
            AcceptContentRequest("sha256:changed"),
        ).body!!

        // The response must reflect post-discovery state, so the ordering matters.
        inOrder(definitionService, discoveryService) {
            verify(definitionService).acceptContent(definitionId, "sha256:changed")
            verify(discoveryService).discoverHost(hostId)
            verify(definitionService).get(definitionId)
        }
        assertThat(body.requiresReacceptance).isFalse()
        assertThat(body.contentHash).isEqualTo("sha256:changed")
    }

    @Test
    fun `acceptDefinitionContent still answers when the immediate re-discovery fails`() {
        val accepted = definition(contentHash = "sha256:changed")
        whenever(definitionService.acceptContent(eq(definitionId), any())).thenReturn(accepted)
        whenever(definitionService.get(definitionId)).thenReturn(accepted)
        whenever(discoveryService.discoverHost(any())).thenThrow(RuntimeException("host down"))

        val response = resource.acceptDefinitionContent(
            definitionId,
            AcceptContentRequest("sha256:changed"),
        )

        assertThat(response.body!!.contentHash).isEqualTo("sha256:changed")
    }
}
