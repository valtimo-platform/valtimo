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
        val uri = buildUri(baseUrl, "/api/host/plugins")
        val headers = HttpHeaders().apply {
            setBearerAuth(adminToken)
        }
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
    ): Boolean = try {
        val uri = buildUri(baseUrl, "/api/host/configurations/$configId")
        val body = objectMapper.createObjectNode().apply {
            put("pluginId", pluginId)
            put("pluginVersion", pluginVersion)
            set<ObjectNode>("properties", properties)
            put("serviceToken", serviceToken)
            put("gzacBaseUrl", gzacBaseUrl)
        }
        val headers = HttpHeaders().apply {
            setBearerAuth(adminToken)
            contentType = MediaType.APPLICATION_JSON
        }
        val request = RequestEntity(objectMapper.writeValueAsBytes(body), headers, HttpMethod.POST, uri)
        restTemplate.exchange(request, JsonNode::class.java).statusCode.is2xxSuccessful
    } catch (e: Exception) {
        false
    }

    fun deleteConfiguration(baseUrl: String, adminToken: String, configId: String): Boolean = try {
        val uri = buildUri(baseUrl, "/api/host/configurations/$configId")
        val headers = HttpHeaders().apply {
            setBearerAuth(adminToken)
        }
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
    ): ActionResponse {
        val uri = buildUri(baseUrl, "/plugins/$pluginId/$version/actions/$actionKey")
        val body = objectMapper.writeValueAsBytes(payload)

        val headers = HttpHeaders().apply {
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
        val uri = buildUri(baseUrl, "/api/host/plugins")
        val resource = object : ByteArrayResource(fileBytes) {
            override fun getFilename(): String = fileName
        }
        val body = LinkedMultiValueMap<String, Any>().apply {
            add("file", resource)
        }
        val headers = HttpHeaders().apply {
            setBearerAuth(adminToken)
            contentType = MediaType.MULTIPART_FORM_DATA
        }
        val request = RequestEntity(body, headers, HttpMethod.POST, uri)
        return restTemplate.exchange(request, JsonNode::class.java).body
            ?: objectMapper.createObjectNode()
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
}
