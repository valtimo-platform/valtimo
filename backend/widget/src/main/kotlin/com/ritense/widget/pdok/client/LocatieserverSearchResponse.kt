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

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

@JsonIgnoreProperties(ignoreUnknown = true)
data class LocatieserverSearchResponse(
    val response: LocatieserverResponseBody,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class LocatieserverResponseBody(
    val numFound: Int = 0,
    val docs: List<LocatieserverDoc> = emptyList(),
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class LocatieserverDoc(
    @JsonProperty("centroide_ll") val centroideLl: String? = null,
    @JsonProperty("centroide_rd") val centroideRd: String? = null,
    val weergavenaam: String? = null,
    val type: String? = null,
    val id: String? = null,
)
