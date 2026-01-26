/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.iko.client

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.iko.dto.ContainerParam
import com.ritense.valtimo.contract.utils.SecurityUtils
import io.github.oshai.kotlinlogging.KotlinLogging
import java.net.URI
import java.util.Base64
import org.springframework.http.HttpHeaders.AUTHORIZATION
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import org.springframework.web.client.body

class IkoClient(
    private val restClientBuilder: RestClient.Builder,
    private val objectMapper: ObjectMapper,
) {
    fun getByEndpointId(
        baseUrl: URI,
        connectorTag: String,
        connectorInstanceTag: String,
        endpointOperation: String,
        id: String,
        queryParams: Map<String, String> = emptyMap(),
    ): JsonNode {
        try {
            val result = restClientBuilder
                .clone()
                .build()
                .get()
                .uri { uriBuilder ->
                    uriBuilder
                        .scheme(baseUrl.scheme)
                        .host(baseUrl.host)
                        .path(baseUrl.path)
                        .port(baseUrl.port)
                        .pathSegment("endpoints", connectorTag, connectorInstanceTag, endpointOperation, id)
                        .queryParams(
                            LinkedMultiValueMap(
                                queryParams
                                    .map { (key, value) -> key to listOf(value) }
                                    .associate { it })
                        )
                        .build()
                }
                .header(AUTHORIZATION, "Bearer ${SecurityUtils.getCurrentJwtTokenValue()}")
                .retrieve()
                .body<JsonNode>()!!

            return result
        } catch (e: Exception) {
            logger.error(e) { "Failed to get data for connectorTag='$connectorTag', connectorInstanceTag='$connectorInstanceTag', endpointOperation='$endpointOperation'" }
            return jacksonObjectMapper().createObjectNode()
        }
    }

    fun search(
        baseUrl: URI,
        connectorTag: String,
        connectorInstanceTag: String,
        endpointOperation: String,
        queryParams: Map<String, String> = emptyMap(),
    ): JsonNode {
        try {
            val result = restClientBuilder
                .clone()
                .build()
                .get()
                .uri { uriBuilder ->
                    uriBuilder
                        .scheme(baseUrl.scheme)
                        .host(baseUrl.host)
                        .path(baseUrl.path)
                        .port(baseUrl.port)
                        .pathSegment("endpoints", connectorTag, connectorInstanceTag, endpointOperation)
                        .queryParams(
                            LinkedMultiValueMap(
                                queryParams
                                    .map { (key, value) -> key to listOf(value) }
                                    .associate { it })
                        )
                        .build()
                }
                .header(AUTHORIZATION, "Bearer ${SecurityUtils.getCurrentJwtTokenValue()}")
                .retrieve()
                .body<JsonNode>()!!

            return result
        } catch (e: Exception) {
            logger.error(e) { "Failed to search data for connectorTag='$connectorTag', connectorInstanceTag='$connectorInstanceTag', endpointOperation='$endpointOperation'" }
            return jacksonObjectMapper().createArrayNode()
        }
    }

    fun getByAggregatedDataProfileId(
        baseUrl: URI,
        aggregatedDataProfileName: String,
        id: String,
        containerParams: List<ContainerParam> = emptyList(),
        additionalQueryParams: Map<String, String> = emptyMap(),
    ): JsonNode {
        val encoder = Base64.getUrlEncoder()

        val encodedContainerParams = containerParams.map { param ->
            encoder.encodeToString(objectMapper.writeValueAsBytes(param))
        }

        val queryParams = LinkedMultiValueMap<String, String>().apply {
            additionalQueryParams.forEach { (k, v) -> add(k, v) }
            if (encodedContainerParams.isNotEmpty()) {
                addAll("containerParam", encodedContainerParams)
            }
            put("id", listOf(id))
        }

        return runCatching {
            restClientBuilder
                .clone()
                .build()
                .get()
                .uri { b ->
                    b.scheme(baseUrl.scheme)
                        .host(baseUrl.host)
                        .port(baseUrl.port)
                        .path(baseUrl.path)
                        .pathSegment("aggregated-data-profiles")
                        .pathSegment(aggregatedDataProfileName)
                        .queryParams(queryParams)
                        .build()
                }
                .header(AUTHORIZATION, "Bearer ${SecurityUtils.getCurrentJwtTokenValue()}")
                .retrieve()
                .body<JsonNode>()
                ?: objectMapper.createObjectNode()
        }.getOrElse { e ->
            logger.error(e) {
                "Failed to get data for aggregatedDataProfile='$aggregatedDataProfileName', id='$id'"
            }
            objectMapper.createObjectNode()
        }
    }


    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
