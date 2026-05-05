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

import com.fasterxml.jackson.databind.node.ObjectNode
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.Type
import java.util.UUID

@Entity
@Table(name = "external_plugin_definition")
class ExternalPluginDefinition(

    @Id
    @Column(name = "id")
    val id: UUID,

    @Column(name = "plugin_id", nullable = false, unique = true)
    val pluginId: String,

    @Column(name = "version", nullable = false)
    var version: String,

    @Column(name = "name")
    var name: String? = null,

    @Column(name = "description")
    var description: String? = null,

    @Column(name = "provider")
    var provider: String? = null,

    @Column(name = "min_gzac_version")
    var minGzacVersion: String? = null,

    @Column(name = "max_gzac_version")
    var maxGzacVersion: String? = null,

    @Type(value = JsonType::class)
    @Column(name = "config_schema", columnDefinition = "JSON")
    var configSchema: ObjectNode? = null,

    @Type(value = JsonType::class)
    @Column(name = "manifest_json", columnDefinition = "JSON")
    var manifestJson: ObjectNode? = null,

    @Column(name = "host_id", nullable = false)
    val hostId: UUID,

    @Column(name = "base_url", nullable = false)
    var baseUrl: String,

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    var status: ExternalPluginDefinitionStatus,

    @Column(name = "consecutive_misses", nullable = false)
    var consecutiveMisses: Int = 0,
)
