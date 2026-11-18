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

package com.ritense.exchange.client.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

@JsonIgnoreProperties(ignoreUnknown = true)
data class ExchangePublication(
    val id: String,
    val name: String,
    val status: String,
    val publicationType: String? = null,
    val artifacts: List<ExchangeArtifact> = emptyList(),
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class ExchangeArtifact(
    val id: String,
    val versionTag: String? = null,
    val title: String = "",
    val manifestType: String? = null,
    val valtimoVersion: String? = null,
    val fileName: String? = null,
    val dependencies: List<ExchangeArtifactDependency> = emptyList(),
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class ExchangeArtifactDependency(
    val dependencyType: String,
    val key: String,
    val title: String = "",
    val versionTag: String? = null,
)
