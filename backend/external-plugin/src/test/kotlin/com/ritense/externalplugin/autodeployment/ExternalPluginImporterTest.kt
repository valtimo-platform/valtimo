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

package com.ritense.externalplugin.autodeployment

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.externalplugin.service.HostUpdateResult
import com.ritense.externalplugin.web.rest.dto.GrantedEndpointEntry
import com.ritense.externalplugin.web.rest.dto.GrantedEventEntry
import com.ritense.importer.ImportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.env.Environment
import java.util.Optional
import java.util.UUID

class ExternalPluginImporterTest {
    private val objectMapper = ObjectMapper().registerKotlinModule()

    private val hostId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    private val configurationId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    private val definitionId = UUID.fromString("33333333-3333-3333-3333-333333333333")

    private lateinit var environment: Environment
    private lateinit var hostService: ExternalPluginHostService
    private lateinit var configurationService: ExternalPluginConfigurationService
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var packageDeployer: ExternalPluginPackageDeployer
    private lateinit var caseDefinitionRepository: CaseDefinitionRepository
    private lateinit var mappingResolver: PluginConfigurationMappingResolver
    private lateinit var importer: ExternalPluginImporter

    @BeforeEach
    fun setUp() {
        environment = mock()
        hostService = mock()
        configurationService = mock()
        definitionRepository = mock()
        configurationRepository = mock()
        packageDeployer = mock()
        caseDefinitionRepository = mock()
        mappingResolver = mock()

        whenever(environment.getProperty(any())).thenReturn(null)
        whenever(hostService.findById(any())).thenReturn(null)
        whenever(hostService.findByBaseUrl(any())).thenReturn(null)
        whenever(hostService.decryptedSecret(any())).thenAnswer { "test-secret" }
        whenever(configurationRepository.findById(any())).thenReturn(Optional.empty())
        whenever(definitionRepository.findByPluginIdAndVersion(any(), any())).thenReturn(definition())
        whenever(definitionRepository.save(any<ExternalPluginDefinition>())).thenAnswer { it.getArgument(0) }
        whenever(caseDefinitionRepository.findAll()).thenReturn(emptyList())
        whenever(
            hostService.register(
                any(), any(), any(), any(), anyOrNull(), anyOrNull(),
                any(), anyOrNull(), any(), any(), any(),
            )
        ).thenAnswer { invocation -> host(id = invocation.getArgument(10)) }
        whenever(
            hostService.update(
                any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(),
                anyOrNull(), any(), anyOrNull(), any(),
            )
        ).thenAnswer { invocation ->
            HostUpdateResult(
                host = host(id = invocation.getArgument(0), baseUrl = invocation.getArgument(2)),
                addressChanged = false,
                credentialsChanged = false,
            )
        }

        importer = ExternalPluginImporter(
            environment,
            objectMapper,
            hostService,
            configurationService,
            definitionRepository,
            configurationRepository,
            packageDeployer,
            caseDefinitionRepository,
            listOf(mappingResolver),
        )
    }

    @Test
    fun `only claims external plugin descriptors under config global`() {
        assertThat(importer.supports("/global/external-plugin/dev.externalplugin.json")).isTrue()
        assertThat(importer.supports("/global/external-plugin/nested/dev.externalplugin.json")).isTrue()
        assertThat(importer.supports("/global/role/admin.role.json")).isFalse()
        assertThat(importer.supports("/case/tab/x.case-tab.json")).isFalse()
    }

    @Test
    fun `is a global import, not part of a case definition`() {
        assertThat(importer.partOfCaseDefinition()).isFalse()
        assertThat(importer.dependsOn()).isEmpty()
    }

    @Test
    fun `registers the integration and activates its configuration`() {
        importer.import(request(descriptorJson()))

        verify(hostService).register(
            eq("Local plugin host"),
            eq("http://localhost:8090"),
            eq("test-secret"),
            eq("http://localhost:8080"),
            eq("amqp://guest:guest@localhost:5672"),
            eq("valtimo-events"),
            eq(EventQueueMode.LIVE),
            anyOrNull(),
            eq(ExternalPluginHostKind.PLUGIN_HOST),
            eq(listOf("http://localhost:4200")),
            eq(hostId),
        )

        val endpoints = argumentCaptor<List<GrantedEndpointEntry>>()
        val events = argumentCaptor<List<GrantedEventEntry>>()
        verify(configurationService).create(
            eq(definitionId),
            eq("Case summary"),
            any(),
            endpoints.capture(),
            events.capture(),
            eq(listOf("gzac_api", "log")),
            eq(listOf("jsonplaceholder.typicode.com")),
            eq(configurationId),
            eq(true),
        )
        assertThat(endpoints.firstValue).containsExactly(GrantedEndpointEntry("GET", "/api/v1/document/*"))
        assertThat(events.firstValue).containsExactly(GrantedEventEntry("com.ritense.valtimo.document.created"))
    }

    @Test
    fun `never contacts the host`() {
        importer.import(request(descriptorJson(withPackage = true)))

        verify(hostService, never()).uploadPlugin(any(), any(), any(), any())
        verify(packageDeployer).register(eq(hostId), any())
    }

    @Test
    fun `creates a placeholder definition when the plugin has not been discovered yet`() {
        whenever(definitionRepository.findByPluginIdAndVersion(any(), any())).thenReturn(null)

        importer.import(request(descriptorJson()))

        val saved = argumentCaptor<ExternalPluginDefinition>()
        verify(definitionRepository).save(saved.capture())
        assertThat(saved.firstValue.pluginId).isEqualTo("case-summary")
        assertThat(saved.firstValue.version).isEqualTo("0.1.0")
        assertThat(saved.firstValue.hostId).isEqualTo(hostId)
        assertThat(saved.firstValue.isPlaceholder).isTrue()

        verify(configurationService).create(
            eq(saved.firstValue.id), any(), any(), any(), any(), any(), any(), eq(configurationId), any(),
        )
    }

    @Test
    fun `a second import reconciles the host with the values it already holds`() {
        whenever(hostService.findById(hostId)).thenReturn(host())
        whenever(configurationRepository.findById(configurationId))
            .thenReturn(Optional.of(ExternalPluginConfiguration(configurationId, definitionId, "Case summary")))

        importer.import(request(descriptorJson(withPackage = true)))

        verify(hostService, never()).register(
            any(), any(), any(), any(), anyOrNull(), anyOrNull(),
            any(), anyOrNull(), any(), any(), any(),
        )
        // One reconciliation call, carrying exactly what is already stored — so nothing moves.
        verify(hostService).update(
            eq(hostId),
            eq("Local plugin host"),
            eq("http://localhost:8090"),
            eq("test-secret"),
            eq("http://localhost:8080"),
            eq("amqp://guest:guest@localhost:5672"),
            eq("valtimo-events"),
            eq(EventQueueMode.LIVE),
            isNull(),
            eq(listOf("http://localhost:4200")),
        )
        verify(hostService, never()).updateFrontendOrigins(any(), any())
        verify(hostService, never()).updateEventQueue(any(), any(), anyOrNull())
        verify(definitionRepository, never()).save(any<ExternalPluginDefinition>())
        verify(configurationService, never()).create(
            any(), any(), any(), any(), any(), any(), any(), any(), any(),
        )
    }

    @Test
    fun `an existing configuration takes the descriptor's title and properties`() {
        whenever(hostService.findById(hostId)).thenReturn(host())
        val stored = ExternalPluginConfiguration(configurationId, definitionId, "Stale title")
        whenever(configurationRepository.findById(configurationId)).thenReturn(Optional.of(stored))
        whenever(configurationService.get(configurationId)).thenReturn(stored)

        importer.import(request(descriptorJson()))

        val properties = argumentCaptor<ObjectNode>()
        verify(configurationService).update(
            eq(configurationId),
            eq("Case summary"),
            properties.capture(),
            anyOrNull(),
        )
        assertThat(properties.firstValue.get("currency").asText()).isEqualTo("EUR")
    }

    @Test
    fun `updating an existing configuration never touches its grants`() {
        whenever(hostService.findById(hostId)).thenReturn(host())
        val stored = ExternalPluginConfiguration(configurationId, definitionId, "Case summary")
        whenever(configurationRepository.findById(configurationId)).thenReturn(Optional.of(stored))
        whenever(configurationService.get(configurationId)).thenReturn(stored)

        importer.import(request(descriptorJson()))

        // Null grantedEndpoints is what tells `update` to leave the granted sets alone.
        verify(configurationService).update(any(), any(), any(), isNull())
        verify(configurationService, never()).create(
            any(), any(), any(), any(), any(), any(), any(), any(), any(),
        )
    }

    @Test
    fun `a changed base url repoints the host row`() {
        whenever(hostService.findById(hostId)).thenReturn(host(baseUrl = "http://plugin-host:8090"))

        importer.import(request(descriptorJson()))

        verify(hostService).update(
            eq(hostId), any(), eq("http://localhost:8090"), anyOrNull(), anyOrNull(),
            anyOrNull(), anyOrNull(), any(), anyOrNull(), any(),
        )
    }

    @Test
    fun `a changed broker address repoints the host row`() {
        whenever(hostService.findById(hostId)).thenReturn(host())

        importer.import(request(descriptorJson(brokerUrl = "amqp://guest:guest@new-broker:5672")))

        verify(hostService).update(
            eq(hostId), any(), any(), anyOrNull(), anyOrNull(),
            eq("amqp://guest:guest@new-broker:5672"), anyOrNull(), any(), anyOrNull(), any(),
        )
    }

    @Test
    fun `a changed callback url and secret are applied`() {
        whenever(hostService.findById(hostId)).thenReturn(host())

        importer.import(
            request(
                descriptorJson(
                    secret = "rotated-secret",
                    gzacCallbackBaseUrl = "https://gzac.example.com",
                )
            )
        )

        verify(hostService).update(
            eq(hostId), any(), any(), eq("rotated-secret"), eq("https://gzac.example.com"),
            anyOrNull(), anyOrNull(), any(), anyOrNull(), any(),
        )
    }

    @Test
    fun `changed frontend origins are reconciled`() {
        whenever(hostService.findById(hostId)).thenReturn(host(frontendOrigins = "http://localhost:9999"))

        importer.import(request(descriptorJson()))

        verify(hostService).update(
            eq(hostId), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(),
            any(), anyOrNull(), eq(listOf("http://localhost:4200")),
        )
    }

    @Test
    fun `a changed event queue mode is reconciled`() {
        whenever(hostService.findById(hostId)).thenReturn(host())

        importer.import(request(descriptorJson(eventQueueMode = EventQueueMode.DURABLE)))

        verify(hostService).update(
            eq(hostId), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(),
            eq(EventQueueMode.DURABLE), anyOrNull(), any(),
        )
    }

    @Test
    fun `kind drift is reported and the kind is left untouched`() {
        whenever(hostService.findById(hostId)).thenReturn(host(kind = ExternalPluginHostKind.APP))

        importer.import(request(descriptorJson(kind = ExternalPluginHostKind.PLUGIN_HOST)))

        // update() has no kind parameter — the rest still reconciles, the mismatch only warns.
        verify(hostService).update(
            eq(hostId), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull(),
            any(), anyOrNull(), any(),
        )
        verify(hostService, never()).register(
            any(), any(), any(), any(), anyOrNull(), anyOrNull(),
            any(), anyOrNull(), any(), any(), any(),
        )
    }

    @Test
    fun `an integration whose base url is already registered under another id is skipped entirely`() {
        whenever(hostService.findByBaseUrl("http://localhost:8090")).thenReturn(host(id = UUID.randomUUID()))

        importer.import(request(descriptorJson(withPackage = true)))

        verify(hostService, never()).register(
            any(), any(), any(), any(), anyOrNull(), anyOrNull(),
            any(), anyOrNull(), any(), any(), any(),
        )
        verify(packageDeployer, never()).register(any(), any())
        verify(configurationService, never()).create(
            any(), any(), any(), any(), any(), any(), any(), any(), any(),
        )
    }

    @Test
    fun `an app declaring packages is rejected`() {
        assertThatThrownBy {
            importer.import(request(descriptorJson(withPackage = true, kind = ExternalPluginHostKind.APP)))
        }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("Apps serve their own plugin")
    }

    @Test
    fun `a configuration whose plugin belongs to another host is skipped`() {
        whenever(definitionRepository.findByPluginIdAndVersion(any(), any()))
            .thenReturn(definition(hostId = UUID.randomUUID()))

        importer.import(request(descriptorJson()))

        verify(definitionRepository, never()).save(any<ExternalPluginDefinition>())
        verify(configurationService, never()).create(
            any(), any(), any(), any(), any(), any(), any(), any(), any(),
        )
    }

    @Test
    fun `a malformed descriptor fails the import`() {
        assertThatThrownBy { importer.import(request("{ this is not json")) }
            .isInstanceOf(Exception::class.java)
    }

    @Test
    fun `afterImport rechecks configuration issues for every case definition`() {
        val first = CaseDefinitionId.of("case-a", "1.0.0")
        val second = CaseDefinitionId.of("case-b", "1.0.0")
        val definitions = listOf(caseDefinition(first), caseDefinition(second))
        whenever(caseDefinitionRepository.findAll()).thenReturn(definitions)

        importer.afterImport(request(descriptorJson()))

        verify(mappingResolver).recheckIssuesForCaseDefinition(first)
        verify(mappingResolver).recheckIssuesForCaseDefinition(second)
    }

    @Test
    fun `resolves environment placeholders before parsing`() {
        whenever(environment.getProperty("MY_HOST_SECRET")).thenReturn("resolved-secret")

        importer.import(request(descriptorJson(secret = "\${MY_HOST_SECRET:fallback}")))

        verify(hostService).register(
            any(), any(), eq("resolved-secret"), any(), anyOrNull(), anyOrNull(),
            any(), anyOrNull(), any(), any(), any(),
        )
    }

    @Test
    fun `falls back to the placeholder default when the property is unset`() {
        importer.import(request(descriptorJson(secret = "\${MY_HOST_SECRET:fallback}")))

        verify(hostService).register(
            any(), any(), eq("fallback"), any(), anyOrNull(), anyOrNull(),
            any(), anyOrNull(), any(), any(), any(),
        )
    }

    private fun request(json: String) =
        ImportRequest("/global/external-plugin/dev.externalplugin.json", json.toByteArray())

    private fun descriptorJson(
        withPackage: Boolean = false,
        kind: ExternalPluginHostKind = ExternalPluginHostKind.PLUGIN_HOST,
        secret: String = "test-secret",
        baseUrl: String = "http://localhost:8090",
        brokerUrl: String = "amqp://guest:guest@localhost:5672",
        gzacCallbackBaseUrl: String = "http://localhost:8080",
        eventQueueMode: EventQueueMode = EventQueueMode.LIVE,
    ): String = """
        {
          "integrations": [
            {
              "id": "$hostId",
              "name": "Local plugin host",
              "kind": "${kind.name}",
              "baseUrl": "$baseUrl",
              "secret": "$secret",
              "gzacCallbackBaseUrl": "$gzacCallbackBaseUrl",
              "eventBrokerAmqpUrl": "$brokerUrl",
              "eventBrokerExchange": "valtimo-events",
              "eventQueueMode": "${eventQueueMode.name}",
              "frontendOrigins": ["http://localhost:4200"],
              "packages": ${if (withPackage) """[{"resource": "classpath:case-summary-0.1.0.zip"}]""" else "[]"},
              "configurations": [
                {
                  "id": "$configurationId",
                  "title": "Case summary",
                  "pluginId": "case-summary",
                  "pluginVersion": "0.1.0",
                  "properties": {"currency": "EUR"},
                  "grantedCapabilities": ["gzac_api", "log"],
                  "grantedEndpoints": [{"method": "GET", "pattern": "/api/v1/document/*"}],
                  "grantedEvents": ["com.ritense.valtimo.document.created"],
                  "grantedEgress": ["jsonplaceholder.typicode.com"]
                }
              ]
            }
          ]
        }
    """.trimIndent()

    private fun caseDefinition(id: CaseDefinitionId): CaseDefinition = mock<CaseDefinition>().also {
        whenever(it.id).thenReturn(id)
    }

    private fun host(
        id: UUID = hostId,
        baseUrl: String = "http://localhost:8090",
        frontendOrigins: String? = "http://localhost:4200",
        kind: ExternalPluginHostKind = ExternalPluginHostKind.PLUGIN_HOST,
    ) = ExternalPluginHost(
        id = id,
        name = "Local plugin host",
        baseUrl = baseUrl,
        secret = "encrypted",
        status = ExternalPluginHostStatus.UNREACHABLE,
        kind = kind,
        gzacCallbackBaseUrl = "http://localhost:8080",
        eventBrokerAmqpUrl = "amqp://guest:guest@localhost:5672",
        eventBrokerExchange = "valtimo-events",
        frontendOrigins = frontendOrigins,
    )

    private fun definition(hostId: UUID = this.hostId) = ExternalPluginDefinition(
        id = definitionId,
        pluginId = "case-summary",
        version = "0.1.0",
        hostId = hostId,
        baseUrl = "http://localhost:8090/plugins/case-summary",
        status = ExternalPluginDefinitionStatus.AVAILABLE,
    )
}
