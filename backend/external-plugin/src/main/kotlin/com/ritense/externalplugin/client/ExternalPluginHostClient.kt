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
import org.springframework.http.MediaType
import org.springframework.http.RequestEntity
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.HttpServerErrorException
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestTemplate
import java.net.URI
import java.time.Instant

@Component
@SkipComponentScan
class ExternalPluginHostClient(
    private val restTemplate: RestTemplate,
    private val signer: ExternalPluginHmacSigner,
    private val objectMapper: ObjectMapper,
) {

    fun health(baseUrl: String): Boolean = try {
        val (uri, path) = buildUri(baseUrl, "/health")
        val request = signedGet(uri, path)
        restTemplate.exchange(request, JsonNode::class.java).statusCode.is2xxSuccessful
    } catch (_: ResourceAccessException) {
        false
    } catch (_: HttpClientErrorException) {
        false
    } catch (_: HttpServerErrorException) {
        false
    }

    fun listPlugins(baseUrl: String): List<JsonNode> {
        val (uri, path) = buildUri(baseUrl, "/api/host/plugins")
        val request = signedGet(uri, path)
        val response = restTemplate.exchange(request, JsonNode::class.java).body
            ?: return emptyList()
        return when {
            response.isArray -> response.toList()
            response.has("plugins") && response.get("plugins").isArray -> response.get("plugins").toList()
            else -> emptyList()
        }
    }

    fun invokeAction(
        baseUrl: String,
        pluginId: String,
        actionKey: String,
        payload: ObjectNode,
    ): ActionResponse {
        val (uri, path) = buildUri(baseUrl, "/plugins/$pluginId/actions/$actionKey")
        val body = objectMapper.writeValueAsBytes(payload)
        val timestamp = Instant.now().toString()
        val bodyHash = signer.bodyHash(body)
        val signature = signer.sign("POST", path, timestamp, bodyHash)

        val headers = HttpHeaders().apply {
            contentType = MediaType.APPLICATION_JSON
            add(ExternalPluginHmacSigner.TIMESTAMP_HEADER, timestamp)
            add(ExternalPluginHmacSigner.SIGNATURE_HEADER, signature)
        }

        return try {
            val response = restTemplate.exchange(
                RequestEntity(body, headers, org.springframework.http.HttpMethod.POST, uri),
                JsonNode::class.java,
            )
            ActionResponse(status = response.statusCode.value(), body = response.body)
        } catch (e: HttpClientErrorException) {
            ActionResponse(status = e.statusCode.value(), body = parseBody(e.responseBodyAsByteArray))
        }
    }

    private fun parseBody(bytes: ByteArray): JsonNode? = if (bytes.isEmpty()) null else try {
        objectMapper.readTree(bytes)
    } catch (_: Exception) {
        null
    }

    private fun signedGet(uri: URI, path: String): RequestEntity<Void> {
        val timestamp = Instant.now().toString()
        val bodyHash = signer.bodyHash(ByteArray(0))
        val signature = signer.sign("GET", path, timestamp, bodyHash)
        val headers = HttpHeaders().apply {
            add(ExternalPluginHmacSigner.TIMESTAMP_HEADER, timestamp)
            add(ExternalPluginHmacSigner.SIGNATURE_HEADER, signature)
        }
        return RequestEntity<Void>(headers, org.springframework.http.HttpMethod.GET, uri)
    }

    private fun buildUri(baseUrl: String, path: String): Pair<URI, String> {
        val cleanedBase = baseUrl.trimEnd('/')
        return URI.create("$cleanedBase$path") to path
    }

    data class ActionResponse(val status: Int, val body: JsonNode?)
}
