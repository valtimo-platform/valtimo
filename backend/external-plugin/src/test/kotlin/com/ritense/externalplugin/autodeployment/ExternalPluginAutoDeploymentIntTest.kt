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
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.externalplugin.BaseIntegrationTest
import com.ritense.externalplugin.domain.ExternalPluginCapability
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHostKind
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedCapabilityRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEgressRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDiscoveryService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.core.env.Environment
import org.springframework.core.env.MapPropertySource
import org.springframework.core.env.ConfigurableEnvironment
import com.ritense.importer.ImportRequest
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import org.springframework.core.io.ClassPathResource
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.net.InetSocketAddress
import java.util.UUID

class ExternalPluginAutoDeploymentIntTest @Autowired constructor(
    private val environment: Environment,
    private val objectMapper: ObjectMapper,
    private val hostService: ExternalPluginHostService,
    private val configurationService: ExternalPluginConfigurationService,
    private val discoveryService: ExternalPluginDiscoveryService,
    private val packageDeployer: ExternalPluginPackageDeployer,
    private val hostRepository: ExternalPluginHostRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
    private val grantedEventRepository: ExternalPluginGrantedEventRepository,
    private val grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository,
    private val grantedEgressRepository: ExternalPluginGrantedEgressRepository,
    private val caseDefinitionRepository: CaseDefinitionRepository,
    private val pluginConfigurationMappingResolvers: List<PluginConfigurationMappingResolver>,
    private val transactionManager: PlatformTransactionManager,
) : BaseIntegrationTest() {
    @BeforeEach
    fun setUp() {
        (environment as ConfigurableEnvironment).propertySources.addFirst(
            MapPropertySource(
                "external-plugin-autodeployment-test",
                mapOf("test.external-plugin.base-url" to "http://localhost:${server.address.port}")
            )
        )
        uploadCount = 0
        packageDeployer.clear()
        removeDeployedRows()
    }

    @AfterEach
    fun tearDown() {
        removeDeployedRows()
    }

    @Test
    fun `provisions without touching the host, then completes when the host is discovered`() {
        val importer = importer()

        importer.import(descriptorRequest())

        val host = hostRepository.findById(HOST_ID).orElse(null)
        assertThat(host).isNotNull
        assertThat(host.name).isEqualTo("Integration test plugin host")
        assertThat(host.kind).isEqualTo(ExternalPluginHostKind.PLUGIN_HOST)
        assertThat(host.baseUrl).isEqualTo("http://localhost:${server.address.port}")
        assertThat(host.gzacCallbackBaseUrl).isEqualTo("http://localhost:8080")
        assertThat(host.eventBrokerAmqpUrl).isEqualTo("amqp://guest:guest@localhost:5672")
        assertThat(host.frontendOriginList).containsExactly("http://localhost:4200")
        assertThat(host.secret).isNotEqualTo("test-secret")
        assertThat(hostService.decryptedSecret(host)).isEqualTo("test-secret")

        assertThat(uploadCount).isEqualTo(0)
        assertThat(host.status).isEqualTo(ExternalPluginHostStatus.UNREACHABLE)

        val placeholder = definitionRepository.findByPluginIdAndVersion("case-summary", "0.1.0")
        assertThat(placeholder).isNotNull
        assertThat(placeholder!!.hostId).isEqualTo(HOST_ID)
        assertThat(placeholder.manifestJson).isNull()
        assertThat(placeholder.configSchema).isNull()
        assertThat(placeholder.contentHash).isNull()
        assertThat(placeholder.status).isEqualTo(ExternalPluginDefinitionStatus.UNAVAILABLE)

        val configuration = configurationRepository.findById(CONFIGURATION_ID).orElse(null)
        assertThat(configuration).isNotNull
        assertThat(configuration.title).isEqualTo("Case summary (deployed)")
        assertThat(configuration.definitionId).isEqualTo(placeholder.id)
        assertThat(configuration.properties!!.get("currency").asText()).isEqualTo("EUR")

        assertThat(grantedEndpointRepository.findAllByConfigurationId(CONFIGURATION_ID))
            .singleElement()
            .satisfies({
                assertThat(it.httpMethod).isEqualTo("GET")
                assertThat(it.endpointPattern).isEqualTo("/api/v1/document/*")
            })
        assertThat(grantedEventRepository.findAllByConfigurationId(CONFIGURATION_ID))
            .extracting<String> { it.eventType }
            .containsExactly("com.ritense.valtimo.document.created")
        assertThat(grantedCapabilityRepository.findAllByConfigurationId(CONFIGURATION_ID))
            .extracting<ExternalPluginCapability> { it.capability }
            .containsExactlyInAnyOrder(ExternalPluginCapability.GZAC_API, ExternalPluginCapability.LOG)
        assertThat(grantedEgressRepository.findAllByConfigurationId(CONFIGURATION_ID))
            .extracting<String> { it.target }
            .containsExactly("jsonplaceholder.typicode.com")

        discoveryService.discoverHost(HOST_ID)

        assertThat(uploadCount).isEqualTo(1)

        val definition = definitionRepository.findByPluginIdAndVersion("case-summary", "0.1.0")!!
        assertThat(definition.id).isEqualTo(placeholder.id)
        assertThat(definition.manifestJson).isNotNull
        assertThat(definition.configSchema).isNotNull
        assertThat(definition.status).isEqualTo(ExternalPluginDefinitionStatus.AVAILABLE)
        assertThat(definition.contentHash).isEqualTo(CONTENT_HASH)
        assertThat(definition.pendingContentHash).isNull()
        assertThat(hostRepository.findById(HOST_ID).orElseThrow().status)
            .isEqualTo(ExternalPluginHostStatus.CONNECTED)

        assertThat(grantedCapabilityRepository.findAllByConfigurationId(CONFIGURATION_ID)).hasSize(2)

        val hostCount = hostRepository.count()
        val configurationCount = configurationRepository.count()

        importer.import(descriptorRequest())
        discoveryService.discoverHost(HOST_ID)

        assertThat(hostRepository.count()).isEqualTo(hostCount)
        assertThat(configurationRepository.count()).isEqualTo(configurationCount)
        assertThat(grantedEndpointRepository.findAllByConfigurationId(CONFIGURATION_ID)).hasSize(1)
        assertThat(grantedEventRepository.findAllByConfigurationId(CONFIGURATION_ID)).hasSize(1)
        assertThat(grantedCapabilityRepository.findAllByConfigurationId(CONFIGURATION_ID)).hasSize(2)
        assertThat(grantedEgressRepository.findAllByConfigurationId(CONFIGURATION_ID)).hasSize(1)
        assertThat(uploadCount).isEqualTo(1)
    }

    private fun importer() = ExternalPluginImporter(
        environment,
        objectMapper,
        hostService,
        configurationService,
        definitionRepository,
        configurationRepository,
        packageDeployer,
        caseDefinitionRepository,
        pluginConfigurationMappingResolvers,
    )

    private fun descriptorRequest() = ImportRequest(
        "/global/external-plugin/dev.externalplugin.json",
        ClassPathResource(DESCRIPTOR).inputStream.use { it.readBytes() },
    )

    private fun removeDeployedRows() = TransactionTemplate(transactionManager).executeWithoutResult {
        grantedEndpointRepository.deleteAllByConfigurationId(CONFIGURATION_ID)
        grantedEventRepository.deleteAllByConfigurationId(CONFIGURATION_ID)
        grantedCapabilityRepository.deleteAllByConfigurationId(CONFIGURATION_ID)
        grantedEgressRepository.deleteAllByConfigurationId(CONFIGURATION_ID)
        configurationRepository.findById(CONFIGURATION_ID).ifPresent { configurationRepository.delete(it) }
        definitionRepository.findByPluginIdAndVersion("case-summary", "0.1.0")
            ?.let { definitionRepository.delete(it) }
        hostRepository.findById(HOST_ID).ifPresent { hostRepository.delete(it) }
    }

    companion object {
        private val HOST_ID: UUID = UUID.fromString("5f0b1a10-0000-4000-8000-00000000f001")
        private val CONFIGURATION_ID: UUID = UUID.fromString("5f0b1a10-0000-4000-8000-00000000c001")
        private const val DESCRIPTOR = "config/external-plugin-test/test-integration-descriptor.json"

        private val MANIFEST = """
            {
              "pluginId": "case-summary",
              "version": "0.1.0",
              "provider": "Ritense",
              "translations": {"en": {"name": "Case Summary", "description": "Integration test fixture"}},
              "configurationSchema": {
                "type": "object",
                "properties": {"currency": {"type": "string"}},
                "additionalProperties": false
              },
              "permissions": {
                "capabilities": ["gzac_api", "log"],
                "egress": ["jsonplaceholder.typicode.com"],
                "endpoints": [{"method": "GET", "pattern": "/api/v1/document/*"}]
              },
              "eventSubscriptions": ["com.ritense.valtimo.document.created"],
              "actions": []
            }
        """.trimIndent()

        private const val CONTENT_HASH = "sha256:0000000000000000000000000000000000000000000000000000000000000001"

        @Volatile
        private var uploadCount = 0

        private val server: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext("/") { exchange -> handle(exchange) }
            executor = null
            start()
        }

        private fun handle(exchange: HttpExchange) {
            val path = exchange.requestURI.path
            val method = exchange.requestMethod
            exchange.requestBody.readBytes()
            when {
                path == "/health" -> respond(exchange, 200, """{"status":"ok"}""")
                path == "/api/host/gzac-instances" -> respond(exchange, 200, "{}")
                path == "/api/host/plugins" && method == "GET" ->
                    respond(
                        exchange,
                        200,
                        """[{"pluginId":"case-summary","version":"0.1.0","contentHash":"$CONTENT_HASH","manifest":$MANIFEST}]"""
                    )
                path == "/api/host/plugins" && method == "POST" -> {
                    uploadCount++
                    if (uploadCount == 1) {
                        respond(
                            exchange,
                            201,
                            """{"pluginId":"case-summary","version":"0.1.0","contentHash":"$CONTENT_HASH"}"""
                        )
                    } else {
                        respond(
                            exchange,
                            409,
                            """{"code":"PLUGIN_VERSION_EXISTS","currentContentHash":"$CONTENT_HASH","uploadedContentHash":"$CONTENT_HASH"}"""
                        )
                    }
                }
                path == "/api/host/configurations" && method == "GET" -> respond(exchange, 200, "[]")
                path.startsWith("/api/host/configurations/") -> respond(exchange, 200, "{}")
                else -> respond(exchange, 404, """{"error":"not stubbed: $method $path"}""")
            }
        }

        private fun respond(exchange: HttpExchange, status: Int, body: String) {
            val bytes = body.toByteArray()
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(status, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }

        @JvmStatic
        @AfterAll
        fun stopServer() {
            server.stop(0)
        }
    }
}
