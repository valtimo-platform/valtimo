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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.externalplugin.security.ExternalPluginHmacSigner
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.RequestEntity
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.ResourceAccessException
import org.springframework.core.io.ByteArrayResource
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestTemplate
import java.net.URI
import java.time.Instant

@Component
@SkipComponentScan
class ExternalPluginHostClient(
    private val restTemplate: RestTemplate,
    private val objectMapper: ObjectMapper,
) {

    fun health(baseUrl: String): Boolean = try {
        val uri = buildUri(baseUrl, "/health")
        val request = RequestEntity<Void>(HttpMethod.GET, uri)
        restTemplate.exchange(request, JsonNode::class.java).statusCode.is2xxSuccessful
    } catch (_: ResourceAccessException) {
        false
    } catch (_: HttpClientErrorException) {
        false
    } catch (_: HttpServerErrorException) {
        false
    }

    fun listPlugins(baseUrl: String, adminToken: String): List<JsonNode> {
        val path = "/api/host/plugins"
        val uri = buildUri(baseUrl, path)
        val headers = hmacHeaders(adminToken, HttpMethod.GET.name(), path, EMPTY_BODY)
        val request = RequestEntity<Void>(headers, HttpMethod.GET, uri)
        val response = restTemplate.exchange(request, JsonNode::class.java).body
            ?: return emptyList()
        return when {
            response.isArray -> response.toList()
            response.has("plugins") && response.get("plugins").isArray -> response.get("plugins").toList()
            else -> emptyList()
        }
    }

    fun pushConfiguration(
        baseUrl: String,
        adminToken: String,
        configId: String,
        pluginId: String,
        pluginVersion: String,
        properties: ObjectNode,
        serviceToken: String,
        gzacBaseUrl: String,
        /** The CloudEvent types the admin granted. The host uses this list — not the manifest. */
        eventSubscriptions: List<String>,
        eventBrokerUrl: String?,
        eventBrokerExchange: String,
        eventBrokerExchangeType: String,
    ): Boolean = try {
        val path = "/api/host/configurations/$configId"
        val uri = buildUri(baseUrl, path)
        val body = objectMapper.createObjectNode().apply {
            put("pluginId", pluginId)
            put("pluginVersion", pluginVersion)
            set<ObjectNode>("properties", properties)
            put("serviceToken", serviceToken)
            put("gzacBaseUrl", gzacBaseUrl)
            // Authoritative subscription list — replaces whatever the manifest declares.
            set<ObjectNode>("eventSubscriptions", objectMapper.createArrayNode().apply {
                eventSubscriptions.forEach { add(it) }
            })
            // The host learns this GZAC instance's broker from the push (it never configures one
            // itself). Omitted when no broker is configured — events are then disabled for the config.
            if (!eventBrokerUrl.isNullOrBlank()) {
                set<ObjectNode>("eventBroker", objectMapper.createObjectNode().apply {
                    put("amqpUrl", eventBrokerUrl)
                    put("exchange", eventBrokerExchange)
                    put("exchangeType", eventBrokerExchangeType)
                })
            }
        }
        // Sign and send the exact same bytes: the host's HMAC check binds this body, so the service
        // token and broker credentials it carries cannot be replayed or altered in flight.
        val bodyBytes = objectMapper.writeValueAsBytes(body)
        val headers = hmacHeaders(adminToken, HttpMethod.POST.name(), path, bodyBytes).apply {
            contentType = MediaType.APPLICATION_JSON
        }
        val request = RequestEntity(bodyBytes, headers, HttpMethod.POST, uri)
        restTemplate.exchange(request, JsonNode::class.java).statusCode.is2xxSuccessful
    } catch (e: Exception) {
        false
    }

    fun deleteConfiguration(baseUrl: String, adminToken: String, configId: String): Boolean = try {
        val path = "/api/host/configurations/$configId"
        val uri = buildUri(baseUrl, path)
        val headers = hmacHeaders(adminToken, HttpMethod.DELETE.name(), path, EMPTY_BODY)
        val request = RequestEntity<Void>(headers, HttpMethod.DELETE, uri)
        restTemplate.exchange(request, Void::class.java).statusCode.is2xxSuccessful
    } catch (e: Exception) {
        false
    }

    fun invokeAction(
        baseUrl: String,
        pluginId: String,
        version: String,
        actionKey: String,
        payload: ObjectNode,
        hostSecret: String,
    ): ActionResponse {
        val path = "/plugins/$pluginId/$version/actions/$actionKey"
        val uri = buildUri(baseUrl, path)
        val body = objectMapper.writeValueAsBytes(payload)

        val headers = hmacHeaders(hostSecret, HttpMethod.POST.name(), path, body).apply {
            contentType = MediaType.APPLICATION_JSON
        }

        return try {
            val response = restTemplate.exchange(
                RequestEntity(body, headers, HttpMethod.POST, uri),
                JsonNode::class.java,
            )
            ActionResponse(status = response.statusCode.value(), body = response.body)
        } catch (e: HttpClientErrorException) {
            ActionResponse(status = e.statusCode.value(), body = parseBody(e.responseBodyAsByteArray))
        }
    }

    fun uploadPlugin(
        baseUrl: String,
        adminToken: String,
        fileName: String,
        fileBytes: ByteArray,
    ): JsonNode {
        val path = "/api/host/plugins"
        val uri = buildUri(baseUrl, path)
        val resource = object : ByteArrayResource(fileBytes) {
            override fun getFilename(): String = fileName
        }
        val body = LinkedMultiValueMap<String, Any>().apply {
            add("file", resource)
        }
        // The signature binds the uploaded file bytes, not the multipart envelope (whose boundary
        // RestTemplate generates internally and the host cannot reproduce). The host recomputes the
        // hash over the same file bytes after parsing the upload.
        val headers = hmacHeaders(adminToken, HttpMethod.POST.name(), path, fileBytes).apply {
            contentType = MediaType.MULTIPART_FORM_DATA
        }
        val request = RequestEntity(body, headers, HttpMethod.POST, uri)
        return restTemplate.exchange(request, JsonNode::class.java).body
            ?: objectMapper.createObjectNode()
    }

    /**
     * Builds the HMAC signature headers shared by every GZAC→host request. The key is the host's
     * decrypted secret (its `ADMIN_TOKEN`); the signature covers `{method}\n{path}\n{timestamp}\n
     * {bodyHash}` and the timestamp gives the host a ±5-minute replay window. Routes with no request
     * body pass [EMPTY_BODY].
     */
    private fun hmacHeaders(
        secret: String,
        method: String,
        path: String,
        body: ByteArray,
    ): HttpHeaders {
        val signer = ExternalPluginHmacSigner(secret)
        val timestamp = Instant.now().toString()
        val signature = signer.sign(method, path, timestamp, signer.bodyHash(body))
        return HttpHeaders().apply {
            set(ExternalPluginHmacSigner.SIGNATURE_HEADER, signature)
            set(ExternalPluginHmacSigner.TIMESTAMP_HEADER, timestamp)
        }
    }

    private fun parseBody(bytes: ByteArray): JsonNode? = if (bytes.isEmpty()) null else try {
        objectMapper.readTree(bytes)
    } catch (_: Exception) {
        null
    }

    private fun buildUri(baseUrl: String, path: String): URI {
        val cleanedBase = baseUrl.trimEnd('/')
        return URI.create("$cleanedBase$path")
    }

    data class ActionResponse(val status: Int, val body: JsonNode?)

    private companion object {
        private val EMPTY_BODY = ByteArray(0)
    }
}
