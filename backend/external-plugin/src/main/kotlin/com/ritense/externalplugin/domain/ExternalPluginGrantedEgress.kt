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
import jakarta.persistence.UniqueConstraint
import java.time.Instant
import java.util.UUID

/**
 * One origin the admin accepted as an `http_request` destination for a configuration, taken from the
 * plugin manifest's `permissions.egress`. The fourth grant alongside endpoints, events and
 * capabilities, and immutable for the same reason: a plugin silently gaining a destination on a
 * configuration edit is exactly what the egress allowlist exists to prevent. Resetting the set
 * requires the admin-confirmed version overwrite, which re-runs the acceptance screen.
 *
 * Environment-specific destinations are *not* stored here — they are derived at push time from the
 * configuration properties the admin filled in (see `PluginEgressTargets`), because those values
 * legitimately change when a configuration is edited.
 */
@Entity
@Table(
    name = "external_plugin_granted_egress",
    uniqueConstraints = [
        UniqueConstraint(
            name = "ext_plugin_granted_egress_config_target_uq",
            columnNames = ["configuration_id", "target"]
        )
    ]
)
class ExternalPluginGrantedEgress(

    @Id
    @Column(name = "id")
    val id: UUID,

    @Column(name = "configuration_id", nullable = false)
    val configurationId: UUID,

    /** The declared origin, stored exactly as the manifest wrote it (e.g. `api.kvk.nl`). */
    @Column(name = "target", nullable = false, length = 512)
    val target: String,

    @Column(name = "granted_at", nullable = false)
    val grantedAt: Instant = Instant.now(),
)
