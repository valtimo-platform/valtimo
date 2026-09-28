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

package com.ritense.externalplugin.client

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.client.ExternalPluginHostClient.HostConfigurationSummary
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestTemplate

/**
 * Guards [ExternalPluginHostClient.listConfigurations]'s contract for the reconciliation pass:
 * strict parsing (a half-parsed listing must abort, never masquerade as an empty host, because
 * *deletion decisions* are made from it), `null` for hosts that predate the endpoint (skip
 * reconciliation, keep everything else working), and propagation of real failures so the poll
 * counts as failed. Also pins [ExternalPluginHostClient.deleteConfiguration]'s idempotent-delete
 * semantics: an already-gone configuration is success, not an error.
 */
class ExternalPluginHostClientConfigurationListingTest {

    private val secret = "host-admin-secret"
    private val baseUrl = "http://plugin-host:8090"
    private val listUrl = "$baseUrl/api/host/configurations"
    private val objectMapper = ObjectMapper()
    private lateinit var restTemplate: RestTemplate
    private lateinit var server: MockRestServiceServer
    private lateinit var client: ExternalPluginHostClient

    @BeforeEach
    fun setup() {
        restTemplate = RestTemplate()
        server = MockRestServiceServer.createServer(restTemplate)
        client = ExternalPluginHostClient(restTemplate, objectMapper)
    }

    @Test
    fun `parses owner-attributed summaries and maps a missing owner to null`() {
        server.expect(requestTo(listUrl)).andRespond(
            withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_JSON).body(
                """
                [
                  {"configurationId": "cfg-1", "pluginId": "case-summary", "pluginVersion": "0.1.0", "ownerId": "host-row-1"},
                  {"configurationId": "cfg-2", "pluginId": "case-summary", "pluginVersion": "0.1.0", "ownerId": null},
                  {"configurationId": "cfg-3"}
                ]
                """.trimIndent()
            )
        )

        val summaries = client.listConfigurations(baseUrl, secret)

        assertThat(summaries).containsExactly(
            HostConfigurationSummary("cfg-1", "host-row-1"),
            // Unowned entries (pre-ownership hosts or GZACs) parse fine — never delete candidates.
            HostConfigurationSummary("cfg-2", null),
            HostConfigurationSummary("cfg-3", null),
        )
    }

    @Test
    fun `accepts the wrapped configurations shape`() {
        server.expect(requestTo(listUrl)).andRespond(
            withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_JSON)
                .body("""{"configurations": [{"configurationId": "cfg-1", "ownerId": "host-row-1"}]}""")
        )

        assertThat(client.listConfigurations(baseUrl, secret))
            .containsExactly(HostConfigurationSummary("cfg-1", "host-row-1"))
    }

    @Test
    fun `returns null when the host does not implement the listing endpoint`() {
        // An older host or a minimal app (404) — the caller must skip reconciliation, not fail.
        server.expect(requestTo(listUrl)).andRespond(withStatus(HttpStatus.NOT_FOUND))
        assertThat(client.listConfigurations(baseUrl, secret)).isNull()
        server.verify()
    }

    @Test
    fun `returns null when the host rejects the method`() {
        server.expect(requestTo(listUrl)).andRespond(withStatus(HttpStatus.METHOD_NOT_ALLOWED))
        assertThat(client.listConfigurations(baseUrl, secret)).isNull()
    }

    @Test
    fun `throws on a listing body that is not an array`() {
        server.expect(requestTo(listUrl)).andRespond(
            withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_JSON).body("""{"unexpected": true}""")
        )

        assertThatThrownBy { client.listConfigurations(baseUrl, secret) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("malformed configuration listing")
    }

    @Test
    fun `throws on a listing entry without a configurationId`() {
        server.expect(requestTo(listUrl)).andRespond(
            withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_JSON)
                .body("""[{"ownerId": "host-row-1"}]""")
        )

        assertThatThrownBy { client.listConfigurations(baseUrl, secret) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("without a configurationId")
    }

    @Test
    fun `propagates an authentication failure so the poll counts as failed`() {
        server.expect(requestTo(listUrl)).andRespond(withStatus(HttpStatus.UNAUTHORIZED))

        assertThatThrownBy { client.listConfigurations(baseUrl, secret) }
            .isInstanceOf(HttpClientErrorException::class.java)
    }

    @Test
    fun `deleteConfiguration treats an already-deleted configuration as success`() {
        server.expect(requestTo("$listUrl/cfg-1")).andRespond(withStatus(HttpStatus.NOT_FOUND))
        assertThat(client.deleteConfiguration(baseUrl, secret, "cfg-1")).isTrue()
    }

    @Test
    fun `deleteConfiguration reports failure on a server error`() {
        server.expect(requestTo("$listUrl/cfg-1")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR))
        assertThat(client.deleteConfiguration(baseUrl, secret, "cfg-1")).isFalse()
    }
}
