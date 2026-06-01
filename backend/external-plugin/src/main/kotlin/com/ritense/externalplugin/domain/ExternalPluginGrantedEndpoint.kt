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

package com.ritense.externalplugin.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "external_plugin_granted_endpoint")
class ExternalPluginGrantedEndpoint(

    @Id
    @Column(name = "id")
    val id: UUID,

    @Column(name = "configuration_id", nullable = false)
    val configurationId: UUID,

    @Column(name = "http_method", nullable = false)
    val httpMethod: String,

    @Column(name = "endpoint_pattern", nullable = false)
    val endpointPattern: String,

    @Column(name = "granted_at", nullable = false)
    val grantedAt: Instant = Instant.now(),
)
