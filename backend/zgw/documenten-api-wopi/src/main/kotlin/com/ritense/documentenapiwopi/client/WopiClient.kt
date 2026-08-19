/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.documentenapiwopi.client

import com.fasterxml.jackson.dataformat.xml.XmlMapper
import com.ritense.documentenapi.DocumentenApiAuthentication
import com.ritense.documentenapiwopi.domain.WopiAccessToken
import com.ritense.documentenapiwopi.domain.WopiDiscovery
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.zgw.ClientTools
import org.springframework.http.converter.ResourceHttpMessageConverter
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.body
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

@SkipComponentScan
@Component
class WopiClient(
    private val restClientBuilder: RestClient.Builder
) {
    private val discoveryCache = ConcurrentHashMap<URI, CachedDiscovery>()

    fun getWopiDiscovery(wopiClientDiscoveryUrl: URI): WopiDiscovery {
        discoveryCache[wopiClientDiscoveryUrl]?.let { cached ->
            if (Instant.now().isBefore(cached.expiresAt)) {
                return cached.discovery
            }
        }

        val result = restClient()
            .get()
            .uri {
                ClientTools.baseUrlToBuilder(it, wopiClientDiscoveryUrl)
                    .build()
            }
            .retrieve()
            .body<WopiDiscovery>()!!

        discoveryCache[wopiClientDiscoveryUrl] = CachedDiscovery(result, Instant.now().plus(DISCOVERY_CACHE_TTL))

        return result
    }

    fun getWopiAccessToken(baseUrl: URI, documentId: String, documentenApiAuthentication: DocumentenApiAuthentication): WopiAccessToken {
        val result = restClient(documentenApiAuthentication)
            .post()
            .uri {
                // replacePath drops baseUrl's own path (e.g. /documenten/); the WOPI extension is mounted at the host root
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .replacePath("/wopi/api/v1/token/$documentId")
                    .build()
            }
            .retrieve()
            .body<WopiAccessToken>()!!

        return result
    }

    fun getWopiHostPage(baseUrl: URI, wopiClientUrl: URI, documentId: String, wopiAccessToken: WopiAccessToken): String {
        val result = restClient()
            .get()
            .uri {
                // replacePath drops baseUrl's own path (e.g. /documenten/); the WOPI extension is mounted at the host root
                ClientTools.baseUrlToBuilder(it, baseUrl)
                    .replacePath("/wopi/files/$documentId")
                    .queryParam("access_token", wopiAccessToken.accessToken)
                    .queryParam("wopiClient", wopiClientUrl.toString())
                    .build()
            }
            .headers { it.setBearerAuth(wopiAccessToken.accessToken) }
            .retrieve()
            .body<String>()!!

        return result
    }

    private fun restClient(): RestClient {
        return restClientBuilder
            .clone()
            .messageConverters {
                it + ResourceHttpMessageConverter(true)
            }
            .build()
    }

    private fun restClient(authentication: DocumentenApiAuthentication): RestClient {
        return restClientBuilder
            .clone()
            .apply {
                authentication.applyAuth(it)
            }
            .messageConverters {
                it + ResourceHttpMessageConverter(true)
            }
            .build()
    }

    private data class CachedDiscovery(val discovery: WopiDiscovery, val expiresAt: Instant)

    companion object {
        private val xmlMapper: XmlMapper = XmlMapper()

        // WOPI discovery is near-static; office suites expect clients to cache it rather than refetch per document open
        private val DISCOVERY_CACHE_TTL: Duration = Duration.ofHours(24)
    }
}