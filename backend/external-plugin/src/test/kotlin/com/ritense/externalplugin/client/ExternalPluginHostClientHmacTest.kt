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
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.security.ExternalPluginHmacSigner
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.mock.http.client.MockClientHttpRequest
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.web.client.RestTemplate
import java.security.MessageDigest
import java.util.HexFormat
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Proves every GZAC→host route the client calls is authenticated with the replay-windowed,
 * body-bound HMAC scheme rather than a static `Authorization: Bearer` token. The expected signature
 * is recomputed here with a plain JDK HMAC (an oracle independent of the production signer) over the
 * canonical `{method}\n{path}\n{timestamp}\n{bodyHash}` string.
 */
class ExternalPluginHostClientHmacTest {

    private val secret = "host-admin-secret"
    private val baseUrl = "http://plugin-host:8090"
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
    fun `pushConfiguration signs the request body and sends no bearer token`() {
        val configId = UUID.randomUUID().toString()
        val serviceToken = "eyJ-fresh-service-token"
        val path = "/api/host/configurations/$configId"

        server.expect(requestTo("$baseUrl$path"))
            .andExpect(method(HttpMethod.POST))
            .andExpect { request ->
                request as MockClientHttpRequest
                // The freshly issued service token must travel inside the signed body, so it cannot
                // be swapped or replayed without breaking the signature.
                val bodyString = String(request.bodyAsBytes)
                assertThat(bodyString).contains(serviceToken)
                // The host learns the queue mode + TTL from this push and uses them to declare its
                // own queue; both must travel inside the signed body so they cannot be swapped.
                assertThat(bodyString).contains("\"queueMode\":\"durable\"")
                assertThat(bodyString).contains("\"queueTtlMs\":259200000")
                assertSigned(request, "POST", path, request.bodyAsBytes)
            }
            .andRespond(
                withStatus(HttpStatus.CREATED)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("""{"configurationId":"$configId"}""")
            )

        val pushed = client.pushConfiguration(
            baseUrl = baseUrl,
            adminToken = secret,
            configId = configId,
            pluginId = "case-summary",
            pluginVersion = "0.1.0",
            properties = objectMapper.createObjectNode(),
            serviceToken = serviceToken,
            gzacBaseUrl = "http://gzac:8080",
            eventSubscriptions = listOf("com.ritense.valtimo.document.created"),
            eventBrokerUrl = "amqp://guest:guest@broker:5672",
            eventBrokerExchange = "valtimo-events",
            eventBrokerExchangeType = "fanout",
            eventQueueMode = EventQueueMode.DURABLE,
            eventQueueTtlMs = 259_200_000L,
        )

        assertThat(pushed).isTrue()
        server.verify()
    }

    @Test
    fun `pushConfiguration omits queueTtlMs from the body when null`() {
        val configId = UUID.randomUUID().toString()
        val path = "/api/host/configurations/$configId"

        server.expect(requestTo("$baseUrl$path"))
            .andExpect(method(HttpMethod.POST))
            .andExpect { request ->
                request as MockClientHttpRequest
                val bodyString = String(request.bodyAsBytes)
                assertThat(bodyString).contains("\"queueMode\":\"live\"")
                assertThat(bodyString).doesNotContain("queueTtlMs")
            }
            .andRespond(
                withStatus(HttpStatus.CREATED)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("""{"configurationId":"$configId"}""")
            )

        client.pushConfiguration(
            baseUrl = baseUrl,
            adminToken = secret,
            configId = configId,
            pluginId = "case-summary",
            pluginVersion = "0.1.0",
            properties = objectMapper.createObjectNode(),
            serviceToken = "service-token",
            gzacBaseUrl = "http://gzac:8080",
            eventSubscriptions = emptyList(),
            eventBrokerUrl = "amqp://guest:guest@broker:5672",
            eventBrokerExchange = "valtimo-events",
            eventBrokerExchangeType = "fanout",
            eventQueueMode = EventQueueMode.LIVE,
            eventQueueTtlMs = null,
        )

        server.verify()
    }

    @Test
    fun `deleteConfiguration signs an empty body and sends no bearer token`() {
        val configId = UUID.randomUUID().toString()
        val path = "/api/host/configurations/$configId"

        server.expect(requestTo("$baseUrl$path"))
            .andExpect(method(HttpMethod.DELETE))
            .andExpect { request ->
                request as MockClientHttpRequest
                assertSigned(request, "DELETE", path, ByteArray(0))
            }
            .andRespond(withStatus(HttpStatus.NO_CONTENT))

        val deleted = client.deleteConfiguration(baseUrl, secret, configId)

        assertThat(deleted).isTrue()
        server.verify()
    }

    @Test
    fun `listPlugins signs an empty body and sends no bearer token`() {
        val path = "/api/host/plugins"

        server.expect(requestTo("$baseUrl$path"))
            .andExpect(method(HttpMethod.GET))
            .andExpect { request ->
                request as MockClientHttpRequest
                assertSigned(request, "GET", path, ByteArray(0))
            }
            .andRespond(
                withStatus(HttpStatus.OK).contentType(MediaType.APPLICATION_JSON).body("[]")
            )

        client.listPlugins(baseUrl, secret)

        server.verify()
    }

    @Test
    fun `uploadPlugin signs the uploaded file bytes rather than the multipart envelope`() {
        val path = "/api/host/plugins"
        val fileBytes = "PK-fake-zip-content".toByteArray()

        server.expect(requestTo("$baseUrl$path"))
            .andExpect(method(HttpMethod.POST))
            .andExpect { request ->
                request as MockClientHttpRequest
                // The signed body is the raw file, not the multipart envelope the wire carries.
                assertThat(request.bodyAsBytes).isNotEqualTo(fileBytes)
                assertSigned(request, "POST", path, fileBytes)
            }
            .andRespond(
                withStatus(HttpStatus.CREATED).contentType(MediaType.APPLICATION_JSON).body("{}")
            )

        client.uploadPlugin(baseUrl, secret, "plugin.zip", fileBytes)

        server.verify()
    }

    private fun assertSigned(
        request: MockClientHttpRequest,
        method: String,
        path: String,
        signedBody: ByteArray,
    ) {
        assertThat(request.headers.getFirst(HttpHeaders.AUTHORIZATION)).isNull()
        val timestamp = request.headers.getFirst(ExternalPluginHmacSigner.TIMESTAMP_HEADER)
        val signature = request.headers.getFirst(ExternalPluginHmacSigner.SIGNATURE_HEADER)
        assertThat(timestamp).isNotNull()
        assertThat(signature).isEqualTo(expectedSignature(method, path, timestamp!!, signedBody))
    }

    private fun expectedSignature(
        method: String,
        path: String,
        timestamp: String,
        body: ByteArray,
    ): String {
        val bodyHash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body))
        val payload = "$method\n$path\n$timestamp\n$bodyHash"
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return HexFormat.of().formatHex(mac.doFinal(payload.toByteArray(Charsets.UTF_8)))
    }
}
