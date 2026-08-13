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
import com.ritense.externalplugin.domain.ExternalPluginCapability
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginGrantedCapability
import com.ritense.externalplugin.domain.ExternalPluginGrantedEndpoint
import com.ritense.externalplugin.domain.ExternalPluginGrantedEvent
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.service.EndpointDescriptionService
import com.ritense.externalplugin.service.EndpointDescription
import com.ritense.externalplugin.service.EndpointQuery
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginDiscoveryService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.externalplugin.web.rest.dto.ConfigurationCreateRequest
import com.ritense.externalplugin.web.rest.dto.ConfigurationUpdateRequest
import com.ritense.externalplugin.web.rest.dto.GrantedEndpointEntry
import com.ritense.externalplugin.web.rest.dto.GrantedEventEntry
import com.ritense.plugin.web.rest.dto.PluginUsageDto
import com.ritense.plugin.web.rest.dto.PluginUsageParentType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import org.springframework.mock.env.MockEnvironment
import java.util.UUID

/**
 * Configuration-facing endpoints of the management resource. Two properties matter beyond plumbing:
 * secret values never travel to the browser (`maskedProperties` omits `x-secret` fields),
 * and the edit flow can never change event or capability grants because `update` has no such
 * parameters to forward.
 */
class ExternalPluginConfigurationResourceTest {

    private lateinit var configurationService: ExternalPluginConfigurationService
    private lateinit var definitionService: ExternalPluginDefinitionService
    private lateinit var hostService: ExternalPluginHostService
    private lateinit var hostClient: ExternalPluginHostClient
    private lateinit var endpointDescriptionService: EndpointDescriptionService
    private lateinit var resource: ExternalPluginManagementResource

    private val configurationId = UUID.randomUUID()
    private val definitionId = UUID.randomUUID()
    private val hostId = UUID.randomUUID()
    private val objectMapper = ObjectMapper()

    @BeforeEach
    fun setUp() {
        configurationService = mock()
        definitionService = mock()
        hostService = mock()
        hostClient = mock()
        endpointDescriptionService = mock()
        resource = ExternalPluginManagementResource(
            hostService = hostService,
            definitionService = definitionService,
            configurationService = configurationService,
            hostClient = hostClient,
            endpointDescriptionService = endpointDescriptionService,
            discoveryService = mock<ExternalPluginDiscoveryService>(),
            environment = MockEnvironment(),
            compatibilityChecker = GzacCompatibilityChecker { "12.0.0" },
            pluginPackageInspector = PluginPackageInspector(objectMapper),
            objectMapper = objectMapper,
        )
    }

    private fun configuration(tokenGeneration: Long = 0) = ExternalPluginConfiguration(
        id = configurationId,
        definitionId = definitionId,
        title = "My configuration",
        properties = objectMapper.createObjectNode().put("apiUrl", "https://example.com"),
        tokenGeneration = tokenGeneration,
    )

    // ---------------------------------------------------------------- create

    @Test
    fun `createConfiguration forwards all three granted sets unchanged for the service to gate`() {
        val request = ConfigurationCreateRequest(
            definitionId = definitionId,
            title = "My configuration",
            properties = objectMapper.createObjectNode().put("apiUrl", "https://example.com"),
            grantedEndpoints = listOf(GrantedEndpointEntry("GET", "/api/v1/document/*")),
            grantedEvents = listOf(GrantedEventEntry("com.ritense.valtimo.document.created")),
            grantedCapabilities = listOf("gzac_api", "log"),
        )
        whenever(
            configurationService.create(any(), any(), any(), any(), any(), any())
        ).thenReturn(configuration())

        val response = resource.createConfiguration(request)

        assertThat(response.statusCode).isEqualTo(HttpStatus.CREATED)
        verify(configurationService).create(
            eq(definitionId),
            eq("My configuration"),
            eq(request.properties),
            eq(listOf(GrantedEndpointEntry("GET", "/api/v1/document/*"))),
            eq(listOf(GrantedEventEntry("com.ritense.valtimo.document.created"))),
            eq(listOf("gzac_api", "log")),
        )
    }

    @Test
    fun `createConfiguration passes empty grant sets through rather than substituting defaults`() {
        val request = ConfigurationCreateRequest(
            definitionId = definitionId,
            title = "No grants",
            properties = objectMapper.createObjectNode(),
            grantedEndpoints = emptyList(),
        )
        whenever(
            configurationService.create(any(), any(), any(), any(), any(), any())
        ).thenReturn(configuration())

        resource.createConfiguration(request)

        verify(configurationService).create(
            eq(definitionId), any(), any(), eq(emptyList()), eq(emptyList()), eq(emptyList())
        )
    }

    @Test
    fun `createConfiguration response carries the token generation but no properties`() {
        whenever(
            configurationService.create(any(), any(), any(), any(), any(), any())
        ).thenReturn(configuration(tokenGeneration = 3))

        val body = resource.createConfiguration(
            ConfigurationCreateRequest(
                definitionId = definitionId,
                title = "t",
                properties = objectMapper.createObjectNode().put("secretish", "value"),
                grantedEndpoints = emptyList(),
            )
        ).body!!

        assertThat(body.tokenGeneration).isEqualTo(3)
        assertThat(body.toString()).doesNotContain("secretish")
    }

    // ---------------------------------------------------------------- read

    @Test
    fun `getConfiguration returns masked properties plus all three granted sets`() {
        val masked: ObjectNode = objectMapper.createObjectNode().put("apiUrl", "https://example.com")
        whenever(configurationService.get(configurationId)).thenReturn(configuration())
        whenever(configurationService.maskedProperties(any())).thenReturn(masked)
        whenever(configurationService.getGrantedEndpoints(configurationId)).thenReturn(
            listOf(
                ExternalPluginGrantedEndpoint(
                    id = UUID.randomUUID(),
                    configurationId = configurationId,
                    httpMethod = "GET",
                    endpointPattern = "/api/v1/document/*",
                )
            )
        )
        whenever(configurationService.getGrantedEvents(configurationId)).thenReturn(
            listOf(
                ExternalPluginGrantedEvent(
                    id = UUID.randomUUID(),
                    configurationId = configurationId,
                    eventType = "com.ritense.valtimo.document.created",
                )
            )
        )
        whenever(configurationService.getGrantedCapabilities(configurationId)).thenReturn(
            listOf(
                ExternalPluginGrantedCapability(
                    id = UUID.randomUUID(),
                    configurationId = configurationId,
                    capability = ExternalPluginCapability.GZAC_API,
                )
            )
        )

        val body = resource.getConfiguration(configurationId).body!!

        assertThat(body.id).isEqualTo(configurationId)
        assertThat(body.properties).isEqualTo(masked)
        assertThat(body.grantedEndpoints.map { it.httpMethod to it.endpointPattern })
            .containsExactly("GET" to "/api/v1/document/*")
        assertThat(body.grantedEvents.map { it.eventType })
            .containsExactly("com.ritense.valtimo.document.created")
        // The capability rides the wire as its lowercase manifest/protocol form.
        assertThat(body.grantedCapabilities.map { it.capability }).containsExactly("gzac_api")
    }

    @Test
    fun `getConfiguration never returns raw stored properties — only the masked projection`() {
        // The stored node still holds the secret; the response must use maskedProperties instead.
        val stored = configuration()
        stored.properties = objectMapper.createObjectNode().put("apiKey", "super-secret")
        whenever(configurationService.get(configurationId)).thenReturn(stored)
        whenever(configurationService.maskedProperties(any()))
            .thenReturn(objectMapper.createObjectNode().put("apiUrl", "https://example.com"))
        whenever(configurationService.getGrantedEndpoints(any())).thenReturn(emptyList())
        whenever(configurationService.getGrantedEvents(any())).thenReturn(emptyList())
        whenever(configurationService.getGrantedCapabilities(any())).thenReturn(emptyList())

        val body = resource.getConfiguration(configurationId).body!!

        assertThat(body.properties.toString()).doesNotContain("super-secret")
        verify(configurationService).maskedProperties(stored)
    }

    @Test
    fun `listConfigurations filters by definition when the query parameter is present`() {
        whenever(configurationService.list(definitionId)).thenReturn(listOf(configuration()))

        val body = resource.listConfigurations(definitionId).body!!

        assertThat(body.map { it.id }).containsExactly(configurationId)
        verify(configurationService).list(definitionId)
    }

    @Test
    fun `listConfigurations passes a null definition id through for the unfiltered list`() {
        whenever(configurationService.list(null)).thenReturn(listOf(configuration()))

        resource.listConfigurations(null)

        verify(configurationService).list(null)
    }

    // ---------------------------------------------------------------- update

    @Test
    fun `updateConfiguration forwards title, properties and endpoint grants only`() {
        val properties = objectMapper.createObjectNode().put("apiUrl", "https://new.example.com")
        whenever(configurationService.update(any(), any(), any(), anyOrNull()))
            .thenReturn(configuration())

        resource.updateConfiguration(
            configurationId,
            ConfigurationUpdateRequest(
                title = "Renamed",
                properties = properties,
                grantedEndpoints = listOf(GrantedEndpointEntry("POST", "/api/v1/document/*/note")),
            ),
        )

        // No event/capability parameters exist to forward — the edit flow cannot widen those grants.
        verify(configurationService).update(
            configurationId,
            "Renamed",
            properties,
            listOf(GrantedEndpointEntry("POST", "/api/v1/document/*/note")),
        )
    }

    @Test
    fun `updateConfiguration forwards a null endpoint list as leave-unchanged`() {
        whenever(configurationService.update(any(), any(), any(), anyOrNull()))
            .thenReturn(configuration())

        resource.updateConfiguration(
            configurationId,
            ConfigurationUpdateRequest(title = "t", properties = objectMapper.createObjectNode()),
        )

        verify(configurationService).update(eq(configurationId), any(), any(), eq(null))
    }

    // ---------------------------------------------------------------- revoke / delete / usages

    @Test
    fun `revokeConfigurationTokens returns the bumped generation`() {
        whenever(configurationService.revokeTokens(configurationId)).thenReturn(configuration(tokenGeneration = 7))

        val body = resource.revokeConfigurationTokens(configurationId).body!!

        assertThat(body.tokenGeneration).isEqualTo(7)
        verify(configurationService).revokeTokens(configurationId)
    }

    @Test
    fun `deleteConfiguration delegates to the guarded service delete and answers 204`() {
        val response = resource.deleteConfiguration(configurationId)

        assertThat(response.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(configurationService).delete(configurationId)
    }

    @Test
    fun `listConfigurationUsages is advisory and read-only`() {
        val usage = PluginUsageDto(
            configurationId = configurationId,
            configurationTitle = "My configuration",
            parentType = PluginUsageParentType.CASE,
            parentKey = "my-case",
            parentVersionTag = "1.0.0",
            tabKey = "summary",
        )
        whenever(configurationService.findUsages(configurationId)).thenReturn(listOf(usage))

        assertThat(resource.listConfigurationUsages(configurationId).body).containsExactly(usage)
        verify(configurationService, never()).delete(any())
    }

    // ---------------------------------------------------------------- log proxy

    @Test
    fun `getConfigurationLogs resolves the configuration's host and forwards every filter`() {
        val definition = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "case-summary",
            version = "0.1.0",
            hostId = hostId,
            baseUrl = "https://plugin-host:8090/plugins/case-summary",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
        )
        val host = ExternalPluginHost(
            id = hostId,
            name = "host",
            baseUrl = "https://plugin-host:8090",
            secret = "encrypted",
            status = ExternalPluginHostStatus.CONNECTED,
        )
        val page = objectMapper.createObjectNode().put("totalElements", 42)
        whenever(configurationService.get(configurationId)).thenReturn(configuration())
        whenever(definitionService.get(definitionId)).thenReturn(definition)
        whenever(hostService.get(hostId)).thenReturn(host)
        whenever(hostService.decryptedSecret(host)).thenReturn("plaintext-admin-token")
        whenever(hostClient.getConfigurationLogs(any(), any(), any(), any(), any(), anyOrNull(), anyOrNull()))
            .thenReturn(page)

        val body = resource.getConfigurationLogs(configurationId, 2, 50, "error", "http_request").body!!

        assertThat(body).isEqualTo(page)
        verify(hostClient).getConfigurationLogs(
            "https://plugin-host:8090",
            "plaintext-admin-token",
            configurationId.toString(),
            2,
            50,
            "error",
            "http_request",
        )
    }

    @Test
    fun `getConfigurationLogs forwards absent filters as null`() {
        val definition = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "case-summary",
            version = "0.1.0",
            hostId = hostId,
            baseUrl = "https://plugin-host:8090/plugins/case-summary",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
        )
        val host = ExternalPluginHost(
            id = hostId,
            name = "host",
            baseUrl = "https://plugin-host:8090",
            secret = "encrypted",
            status = ExternalPluginHostStatus.CONNECTED,
        )
        whenever(configurationService.get(configurationId)).thenReturn(configuration())
        whenever(definitionService.get(definitionId)).thenReturn(definition)
        whenever(hostService.get(hostId)).thenReturn(host)
        whenever(hostService.decryptedSecret(host)).thenReturn("token")
        whenever(hostClient.getConfigurationLogs(any(), any(), any(), any(), any(), anyOrNull(), anyOrNull()))
            .thenReturn(objectMapper.createObjectNode())

        resource.getConfigurationLogs(configurationId, 0, 25, null, null)

        verify(hostClient).getConfigurationLogs(
            any(), any(), any(), eq(0), eq(25), eq(null), eq(null)
        )
    }

    // ---------------------------------------------------------------- endpoint descriptions

    @Test
    fun `resolveEndpointDescriptions forwards the queries and the requested locale`() {
        val queries = listOf(EndpointQuery("GET", "/api/v1/document/*"))
        whenever(endpointDescriptionService.resolveDescriptions(queries, "nl")).thenReturn(
            listOf(EndpointDescription("GET", "/api/v1/document/*", "Zaak ophalen"))
        )

        val body = resource.resolveEndpointDescriptions(queries, "nl").body!!

        assertThat(body.map { it.description }).containsExactly("Zaak ophalen")
        verify(endpointDescriptionService).resolveDescriptions(queries, "nl")
    }
}
