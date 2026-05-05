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
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "external_plugin_host")
class ExternalPluginHost(

    @Id
    @Column(name = "id")
    val id: UUID,

    @Column(name = "name", nullable = false)
    var name: String,

    @Column(name = "base_url", nullable = false)
    var baseUrl: String,

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    var status: ExternalPluginHostStatus,

    @Column(name = "last_health_check")
    var lastHealthCheck: Instant? = null,

    @Column(name = "consecutive_failures", nullable = false)
    var consecutiveFailures: Int = 0,
)
