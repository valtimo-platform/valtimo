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
import com.ritense.externalplugin.domain.EventQueueMode
import com.ritense.externalplugin.security.ExternalPluginHmacSigner
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Component
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.RequestEntity
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

    /**
     * Lists the configurations the host currently holds, as `{configurationId, ownerId}` summaries.
     *
     * Returns `null` when the host does not implement the endpoint (404/405 — an older host or a
     * minimal app): the caller must then skip reconciliation entirely. Any other failure (auth,
     * 5xx, timeout, malformed body) throws — the discovery cycle treats the whole poll as failed.
     * Parsing is deliberately strict: **deletion decisions** are made from this response, so a
     * half-parsed body must abort rather than masquerade as an empty host.
     */
    fun listConfigurations(baseUrl: String, adminToken: String): List<HostConfigurationSummary>? {
        val path = "/api/host/configurations"
        val uri = buildUri(baseUrl, path)
        val headers = hmacHeaders(adminToken, HttpMethod.GET.name(), path, EMPTY_BODY)
        val request = RequestEntity<Void>(headers, HttpMethod.GET, uri)
        val response = try {
            restTemplate.exchange(request, JsonNode::class.java).body
        } catch (_: HttpClientErrorException.NotFound) {
            return null
        } catch (_: HttpClientErrorException.MethodNotAllowed) {
            return null
        }
        val entries = when {
            response == null -> throw IllegalStateException(
                "Plugin host at $baseUrl returned an empty configuration listing body"
            )
            response.isArray -> response.toList()
            response.has("configurations") && response.get("configurations").isArray ->
                response.get("configurations").toList()
            else -> throw IllegalStateException(
                "Plugin host at $baseUrl returned a malformed configuration listing: expected an array"
            )
        }
        return entries.map { entry ->
            val configurationId = entry.get("configurationId")
                ?.takeIf { it.isTextual }?.asText()?.takeIf { it.isNotBlank() }
                ?: throw IllegalStateException(
                    "Plugin host at $baseUrl returned a configuration listing entry without a configurationId"
                )
            // Entries from a host that predates ownership (or rows pushed by an older GZAC) carry
            // no ownerId — they parse fine and are simply unowned, never reconciliation candidates.
            val ownerId = entry.get("ownerId")
                ?.takeIf { it.isTextual }?.asText()?.takeIf { it.isNotBlank() }
            HostConfigurationSummary(configurationId, ownerId)
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
        /**
         * Identity of the GZAC↔host relationship pushing this configuration — the GZAC-side
         * host-row UUID. The host persists it per configuration and echoes it in the configuration
         * listing; the discovery reconciliation pass only ever deletes host configurations carrying
         * this GZAC's ownerId, so multiple GZAC instances sharing one host cannot delete each
         * other's configs.
         */
        ownerId: String,
        /**
         * The package content hash GZAC pinned at discovery. The host verifies its loaded package
         * still matches before accepting the push (409 otherwise), so a config and its fresh
         * service token can never reach plugin code that differs from what the admin accepted.
         */
        expectedContentHash: String? = null,
        /** The CloudEvent types the admin granted. The host uses this list — not the manifest. */
        eventSubscriptions: List<String>,
        grantedCapabilities: List<String> = emptyList(),
        /**
         * The GZAC endpoints the admin granted, as method/Ant-pattern pairs. The host enforces this
         * list on every `gzac_api` call, so the allowlist holds even if GZAC-side token scoping
         * were to regress.
         */
        grantedEndpoints: List<Pair<String, String>> = emptyList(),
        eventBrokerUrl: String?,
        eventBrokerExchange: String,
        eventBrokerExchangeType: String,
        /** Per-host queue declaration mode the plugin-host should use for this broker connection. */
        eventQueueMode: EventQueueMode = EventQueueMode.LIVE,
        /** Queue inactivity TTL in ms; only meaningful when [eventQueueMode] is DURABLE. */
        eventQueueTtlMs: Long? = null,
    ): Boolean = try {
        val path = "/api/host/configurations/$configId"
        val uri = buildUri(baseUrl, path)
        val body = objectMapper.createObjectNode().apply {
            put("pluginId", pluginId)
            put("pluginVersion", pluginVersion)
            set<ObjectNode>("properties", properties)
            put("serviceToken", serviceToken)
            put("gzacBaseUrl", gzacBaseUrl)
            put("ownerId", ownerId)
            if (!expectedContentHash.isNullOrBlank()) put("expectedContentHash", expectedContentHash)
            // Authoritative subscription list — replaces whatever the manifest declares.
            set<ObjectNode>("eventSubscriptions", objectMapper.createArrayNode().apply {
                eventSubscriptions.forEach { add(it) }
            })
            set<ObjectNode>("grantedCapabilities", objectMapper.createArrayNode().apply {
                grantedCapabilities.forEach { add(it) }
            })
            set<ObjectNode>("grantedEndpoints", objectMapper.createArrayNode().apply {
                grantedEndpoints.forEach { (method, pattern) ->
                    addObject().put("method", method).put("pattern", pattern)
                }
            })
            // The host learns this GZAC instance's broker from the push (it never configures one
            // itself). Omitted when no broker is configured — events are then disabled for the config.
            if (!eventBrokerUrl.isNullOrBlank()) {
                set<ObjectNode>("eventBroker", objectMapper.createObjectNode().apply {
                    put("amqpUrl", eventBrokerUrl)
                    put("exchange", eventBrokerExchange)
                    put("exchangeType", eventBrokerExchangeType)
                    put("queueMode", eventQueueMode.name.lowercase())
                    if (eventQueueTtlMs != null) put("queueTtlMs", eventQueueTtlMs)
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
        logger.warn(e) { "Failed to push configuration $configId for plugin '$pluginId@$pluginVersion' to plugin host at $baseUrl" }
        false
    }

    fun deleteConfiguration(baseUrl: String, adminToken: String, configId: String): Boolean = try {
        val path = "/api/host/configurations/$configId"
        val uri = buildUri(baseUrl, path)
        val headers = hmacHeaders(adminToken, HttpMethod.DELETE.name(), path, EMPTY_BODY)
        val request = RequestEntity<Void>(headers, HttpMethod.DELETE, uri)
        restTemplate.exchange(request, Void::class.java).statusCode.is2xxSuccessful
    } catch (_: HttpClientErrorException.NotFound) {
        // Already gone — the goal state. Happens when the discovery reconciliation pass and the
        // direct delete path race, or when a delete is retried after a partial failure.
        true
    } catch (e: Exception) {
        logger.warn(e) { "Failed to delete configuration $configId from plugin host at $baseUrl" }
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

        return exchangeForActionResponse(RequestEntity(body, headers, HttpMethod.POST, uri))
    }

    /**
     * Invokes a plugin's `handle_submit` export for a task-form submission (Level 1). Identical
     * transport to [invokeAction] — HMAC-signed, service-token-authenticated — but routed to the
     * host's submit endpoint. The plugin returns `{status, variables, documentContent}` or
     * `{status: "error", …, fieldErrors}`; the caller decides how to complete or reject.
     */
    fun invokeSubmit(
        baseUrl: String,
        pluginId: String,
        version: String,
        submitKey: String,
        payload: ObjectNode,
        hostSecret: String,
    ): ActionResponse {
        val path = "/plugins/$pluginId/$version/submit/$submitKey"
        val uri = buildUri(baseUrl, path)
        val body = objectMapper.writeValueAsBytes(payload)

        val headers = hmacHeaders(hostSecret, HttpMethod.POST.name(), path, body).apply {
            contentType = MediaType.APPLICATION_JSON
        }

        return exchangeForActionResponse(RequestEntity(body, headers, HttpMethod.POST, uri))
    }

    /**
     * Executes a plugin invocation and maps every failure mode onto an [ActionResponse] so the
     * callers' error paths (`actionFailed`, hook rejection) always engage:
     * - 4xx/5xx from the host → the host's status plus its parsed error body;
     * - connection failure / timeout → a synthetic 503 with a clear "host unreachable" error body.
     */
    private fun exchangeForActionResponse(request: RequestEntity<*>): ActionResponse = try {
        val response = restTemplate.exchange(request, JsonNode::class.java)
        ActionResponse(status = response.statusCode.value(), body = response.body)
    } catch (e: HttpClientErrorException) {
        ActionResponse(status = e.statusCode.value(), body = parseBody(e.responseBodyAsByteArray))
    } catch (e: HttpServerErrorException) {
        logger.warn(e) { "Plugin host at ${request.url} returned ${e.statusCode.value()}" }
        ActionResponse(status = e.statusCode.value(), body = parseBody(e.responseBodyAsByteArray))
    } catch (e: ResourceAccessException) {
        logger.warn(e) { "Plugin host at ${request.url} is unreachable" }
        ActionResponse(
            status = 503,
            body = objectMapper.createObjectNode().apply {
                put("errorCode", HOST_UNREACHABLE_ERROR_CODE)
                put("errorMessage", "Plugin host is unreachable: ${e.message}")
            },
        )
    }

    fun uploadPlugin(
        baseUrl: String,
        adminToken: String,
        fileName: String,
        fileBytes: ByteArray,
        /**
         * Replace an existing pluginId@version. Only sent after an admin explicitly confirmed the
         * overwrite (permission re-review); without it the host refuses a duplicate with 409.
         */
        overwrite: Boolean = false,
    ): JsonNode {
        val path = "/api/host/plugins"
        // The query string is deliberately not signature-bound — the host strips it before HMAC
        // verification (same convention as getConfigurationLogs).
        val uri = buildUri(baseUrl, if (overwrite) "$path?overwrite=true" else path)
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

    fun getConfigurationLogs(
        baseUrl: String,
        adminToken: String,
        configId: String,
        page: Int,
        size: Int,
        level: String?,
        source: String?,
    ): JsonNode {
        val params = mutableListOf("page=$page", "size=$size")
        if (!level.isNullOrBlank()) params.add("level=$level")
        if (!source.isNullOrBlank()) params.add("source=$source")
        val path = "/api/host/configurations/$configId/logs"
        val queryPath = "$path?${params.joinToString("&")}"
        val uri = buildUri(baseUrl, queryPath)
        // Deliberately signs `path` (without the query string), not `queryPath`: the plugin host
        // strips the query string before verifying (`request.url.split("?")[0]` in hmac-auth.ts),
        // so the canonical strings match. Query parameters are not signature-bound by design.
        val headers = hmacHeaders(adminToken, HttpMethod.GET.name(), path, EMPTY_BODY)
        val request = RequestEntity<Void>(headers, HttpMethod.GET, uri)
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

    /**
     * One entry of the host's configuration listing, reduced to what reconciliation needs. The
     * listing is deliberately a redacted summary on the host side — never full configurations.
     */
    data class HostConfigurationSummary(val configurationId: String, val ownerId: String?)

    companion object {
        /** Error code surfaced when the plugin host cannot be reached at all (no HTTP response). */
        const val HOST_UNREACHABLE_ERROR_CODE = "EXTERNAL_PLUGIN_HOST_UNREACHABLE"

        private val EMPTY_BODY = ByteArray(0)
        private val logger = KotlinLogging.logger {}
    }
}
