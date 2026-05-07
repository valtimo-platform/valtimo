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

package com.ritense.widget.pdok.client

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import java.net.URI
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.body

@SkipComponentScan
@Component
class PdokLocatieserverClient(
    private val restClientBuilder: RestClient.Builder,
    private val baseUrl: URI,
) {

    fun searchAddress(
        address: DutchAddress,
        rows: Int = 1,
    ): LocatieserverSearchResponse {
        return buildRestClient()
            .get()
            .uri { uriBuilder ->
                uriBuilder
                    .scheme(baseUrl.scheme)
                    .host(baseUrl.host)
                    .port(baseUrl.port)
                    .path(baseUrl.path.trimEnd('/'))
                    .path("/free")
                    .queryParam("q", buildQuery(address))
                    .queryParam("fl", "id,weergavenaam,type,centroide_ll,centroide_rd")
                    .queryParam("rows", rows)
                    .queryParam("fq", "type:adres")
                    .build()
            }
            .retrieve()
            .body<LocatieserverSearchResponse>()!!
    }

    private fun buildQuery(address: DutchAddress): String {
        return listOfNotNull(
            address.straatnaam,
            address.huisnummer,
            address.huisletter,
            address.huisnummertoevoeging,
            address.postcode,
            address.woonplaats,
        ).filter { it.isNotBlank() }.joinToString(" ")
    }

    private fun buildRestClient(): RestClient {
        return restClientBuilder.clone().build()
    }
}
