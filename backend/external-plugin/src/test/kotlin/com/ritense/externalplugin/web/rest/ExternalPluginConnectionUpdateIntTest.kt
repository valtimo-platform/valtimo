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
import com.ritense.externalplugin.BaseIntegrationTest
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
import com.ritense.externalplugin.web.rest.dto.GrantedEndpointEntry
import com.ritense.externalplugin.web.rest.dto.GrantedEventEntry
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.net.InetSocketAddress
import java.util.UUID

/**
 * The connection PATCH (#618) end to end: HTTP → security matcher → validation mapper → service →
 * PostgreSQL, finishing with the single-host re-discovery that re-pushes every configuration to
 * the (stub) host — the mechanism that makes a repointed broker take effect.
 */
@AutoConfigureMockMvc
class ExternalPluginConnectionUpdateIntTest @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper,
    private val hostService: ExternalPluginHostService,
    private val configurationService: ExternalPluginConfigurationService,
    private val discoveryService: ExternalPluginDiscoveryService,
    private val hostRepository: ExternalPluginHostRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
    private val grantedEventRepository: ExternalPluginGrantedEventRepository,
    private val grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository,
    private val grantedEgressRepository: ExternalPluginGrantedEgressRepository,
    private val transactionManager: PlatformTransactionManager,
) : BaseIntegrationTest() {

    private lateinit var hostId: UUID
    private lateinit var configurationId: UUID

    @BeforeEach
    fun setUp() {
        removeRows()
        configurationPushes.clear()
        // Register against the stub and let discovery pin the plugin, so the configuration under
        // test is a real activated one — the thing #618 must never orphan.
        val host = hostService.register(
            name = "connection-int-test",
            baseUrl = "http://localhost:${server.address.port}",
            secret = "test-secret",
            gzacCallbackBaseUrl = "http://localhost:8080",
            eventBrokerAmqpUrl = "amqp://guest:guest@localhost:5672",
            eventBrokerExchange = null,
        )
        hostId = host.id
        discoveryService.discoverHost(hostId)
        val definition = definitionRepository.findByPluginIdAndVersion(PLUGIN_ID, PLUGIN_VERSION)!!
        configurationId = configurationService.create(
            definition.id,
            "Connection int test",
            objectMapper.createObjectNode().put("currency", "EUR") as ObjectNode,
            listOf(GrantedEndpointEntry("GET", "/api/v1/document/*")),
            listOf(GrantedEventEntry("com.ritense.valtimo.document.created")),
            listOf("gzac_api", "log"),
            listOf("jsonplaceholder.typicode.com"),
        ).id
        configurationPushes.clear()
    }

    @AfterEach
    fun tearDown() = removeRows()

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `updates the connection, redacts the response and re-pushes the configuration`() {
        mockMvc.perform(
            patch("$BASE/host/$hostId/connection")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "renamed",
                      "gzacCallbackBaseUrl": "http://localhost:8081/",
                      "eventBrokerAmqpUrl": "amqp://guest:rotated@localhost:5672",
                      "eventBrokerExchange": "valtimo-events-2"
                    }
                    """.trimIndent()
                )
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.name").value("renamed"))
            .andExpect(jsonPath("$.eventBrokerAmqpUrl").value("amqp://***@localhost:5672"))
            .andExpect(jsonPath("$.eventBrokerExchange").value("valtimo-events-2"))
            .andExpect(jsonPath("$.secret").doesNotExist())

        val host = hostRepository.findById(hostId).orElseThrow()
        assertThat(host.name).isEqualTo("renamed")
        assertThat(host.gzacCallbackBaseUrl).isEqualTo("http://localhost:8081")
        assertThat(host.eventBrokerAmqpUrl).isEqualTo("amqp://guest:rotated@localhost:5672")
        assertThat(host.eventBrokerExchange).isEqualTo("valtimo-events-2")
        // The PATCH ends in discoverHost, whose sync re-pushed the configuration with the new
        // broker — that push is what makes the host's event consumers rebind.
        assertThat(configurationPushes).contains(configurationId.toString())
    }

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `a base url change rewrites the denormalized definition base urls`() {
        val newBaseUrl = "http://127.0.0.1:${server.address.port}"

        mockMvc.perform(
            patch("$BASE/host/$hostId/connection")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"baseUrl": "$newBaseUrl"}""")
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.baseUrl").value(newBaseUrl))

        assertThat(hostRepository.findById(hostId).orElseThrow().baseUrl).isEqualTo(newBaseUrl)
        assertThat(definitionRepository.findByPluginIdAndVersion(PLUGIN_ID, PLUGIN_VERSION)!!.baseUrl)
            .isEqualTo("$newBaseUrl/plugins/$PLUGIN_ID")
    }

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `a blank secret keeps the stored one and a new secret re-encrypts`() {
        val originalCiphertext = hostRepository.findById(hostId).orElseThrow().secret

        mockMvc.perform(
            patch("$BASE/host/$hostId/connection")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"secret": "  "}""")
        ).andExpect(status().isOk)
        assertThat(hostRepository.findById(hostId).orElseThrow().secret).isEqualTo(originalCiphertext)

        mockMvc.perform(
            patch("$BASE/host/$hostId/connection")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"secret": "rotated-token"}""")
        ).andExpect(status().isOk)
        val host = hostRepository.findById(hostId).orElseThrow()
        assertThat(host.secret).isNotEqualTo(originalCiphertext)
        assertThat(hostService.decryptedSecret(host)).isEqualTo("rotated-token")
    }

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `validation failures answer 400 with the operator-facing detail and leave the row alone`() {
        val before = hostRepository.findById(hostId).orElseThrow().baseUrl

        // Plaintext remote base URL while a broker is configured.
        mockMvc.perform(
            patch("$BASE/host/$hostId/connection")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"baseUrl": "http://remote-host:8090"}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("unencrypted transport")))

        // A broker URL echoing the response's redaction marker.
        mockMvc.perform(
            patch("$BASE/host/$hostId/connection")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"eventBrokerAmqpUrl": "amqp://***@localhost:5672"}""")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("redacted")))

        assertThat(hostRepository.findById(hostId).orElseThrow().baseUrl).isEqualTo(before)
    }

    @Test
    @WithMockUser(authorities = [ADMIN])
    fun `a base url already registered as another host is refused`() {
        val other = hostService.register(
            name = "other-host",
            baseUrl = "https://other.example.com",
            secret = "other-secret",
            gzacCallbackBaseUrl = "http://localhost:8080",
            eventBrokerAmqpUrl = null,
            eventBrokerExchange = null,
        )
        try {
            mockMvc.perform(
                patch("$BASE/host/$hostId/connection")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"baseUrl": "https://other.example.com"}""")
            )
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("already registered")))
        } finally {
            hostRepository.deleteById(other.id)
        }
    }

    private fun removeRows() = TransactionTemplate(transactionManager).executeWithoutResult {
        configurationRepository.findAll()
            .filter { it.title == "Connection int test" }
            .forEach { configuration ->
                grantedEndpointRepository.deleteAllByConfigurationId(configuration.id)
                grantedEventRepository.deleteAllByConfigurationId(configuration.id)
                grantedCapabilityRepository.deleteAllByConfigurationId(configuration.id)
                grantedEgressRepository.deleteAllByConfigurationId(configuration.id)
                configurationRepository.delete(configuration)
            }
        definitionRepository.findByPluginIdAndVersion(PLUGIN_ID, PLUGIN_VERSION)
            ?.let { definitionRepository.delete(it) }
        hostRepository.findAll()
            .filter { it.name in setOf("connection-int-test", "renamed", "other-host") }
            .forEach { hostRepository.delete(it) }
    }

    companion object {
        private const val BASE = "/api/management/v1/external-plugin"
        private const val PLUGIN_ID = "connection-test-plugin"
        private const val PLUGIN_VERSION = "1.0.0"
        private const val CONTENT_HASH =
            "sha256:0000000000000000000000000000000000000000000000000000000000000618"

        private val MANIFEST = """
            {
              "pluginId": "$PLUGIN_ID",
              "version": "$PLUGIN_VERSION",
              "provider": "Ritense",
              "translations": {"en": {"name": "Connection test", "description": "Int test fixture"}},
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

        /** Configuration ids the stub host received a push for. */
        private val configurationPushes = mutableListOf<String>()

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
                path == "/api/host/plugins" && method == "GET" -> respond(
                    exchange,
                    200,
                    """[{"pluginId":"$PLUGIN_ID","version":"$PLUGIN_VERSION","contentHash":"$CONTENT_HASH","manifest":$MANIFEST}]"""
                )
                path == "/api/host/configurations" && method == "GET" -> respond(exchange, 200, "[]")
                path.startsWith("/api/host/configurations/") -> {
                    synchronized(configurationPushes) {
                        configurationPushes.add(path.substringAfterLast('/'))
                    }
                    respond(exchange, 200, "{}")
                }
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
