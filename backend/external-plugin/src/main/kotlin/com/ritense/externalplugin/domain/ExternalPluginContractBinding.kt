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
 * Admin's choice of which configuration answers a contract the binding configuration declares in
 * `permissions.contracts`. One per contract; the bound contract list is the grant pushed to the host.
 */
@Entity
@Table(
    name = "external_plugin_contract_binding",
    uniqueConstraints = [
        UniqueConstraint(
            name = "ext_plugin_contract_binding_config_contract_uq",
            columnNames = ["configuration_id", "contract"]
        )
    ]
)
class ExternalPluginContractBinding(

    @Id
    @Column(name = "id")
    val id: UUID,

    @Column(name = "configuration_id", nullable = false)
    val configurationId: UUID,

    @Column(name = "contract", nullable = false)
    val contract: String,

    @Column(name = "target_configuration_id", nullable = false)
    val targetConfigurationId: UUID,

    @Column(name = "bound_at", nullable = false)
    val boundAt: Instant = Instant.now(),
)
