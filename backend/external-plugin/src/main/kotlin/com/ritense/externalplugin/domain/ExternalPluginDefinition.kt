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
import jakarta.persistence.UniqueConstraint
import org.hibernate.annotations.Type
import java.util.UUID

@Entity
@Table(
    name = "external_plugin_definition",
    uniqueConstraints = [
        UniqueConstraint(
            name = "external_plugin_definition_plugin_id_version_uq",
            columnNames = ["plugin_id", "version"]
        )
    ]
)
class ExternalPluginDefinition(

    @Id
    @Column(name = "id")
    val id: UUID,

    @Column(name = "plugin_id", nullable = false)
    val pluginId: String,

    @Column(name = "version", nullable = false)
    val version: String,

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

    /**
     * The package content hash (manifest + wasm + frontend bundles) pinned at discovery. What runs
     * on the host is only trusted while it still matches this value.
     */
    @Column(name = "content_hash")
    var contentHash: String? = null,

    /**
     * Set when discovery finds the host serving *different* content under this pluginId@version
     * than what was pinned. While set, configuration pushes, plugin invocations and user-token
     * minting are withheld until an admin explicitly re-accepts the new content.
     */
    @Column(name = "pending_content_hash")
    var pendingContentHash: String? = null,

    /** The manifest served alongside [pendingContentHash], kept so the two can be compared. */
    @Type(value = JsonType::class)
    @Column(name = "pending_manifest_json", columnDefinition = "JSON")
    var pendingManifestJson: ObjectNode? = null,
) {

    /** True when the host's package changed after acceptance and an admin has not re-accepted it. */
    val requiresReacceptance: Boolean
        get() = pendingContentHash != null

    /**
     * Whether the pending package asks for a different permission footprint than the accepted one.
     * False means only the code changed — a weaker prompt, but still one an admin must answer,
     * because the pin exists to detect a host serving something other than what was accepted.
     */
    val pendingPermissionsChanged: Boolean
        get() {
            val pending = pendingManifestJson ?: return false
            return declaredPermissions(pending) != declaredPermissions(manifestJson)
        }

    private fun declaredPermissions(manifest: ObjectNode?): Set<String> {
        if (manifest == null) return emptySet()
        val permissions = manifest.get("permissions")
        val capabilities = permissions?.get("capabilities")?.mapNotNull { it.asText() }.orEmpty()
        val egress = permissions?.get("egress")?.mapNotNull { it.asText() }.orEmpty()
        val endpoints = permissions?.get("endpoints")?.mapNotNull {
            val method = it.get("method")?.asText() ?: return@mapNotNull null
            val pattern = it.get("pattern")?.asText() ?: return@mapNotNull null
            "endpoint:${method.uppercase()}:$pattern"
        }.orEmpty()
        val events = manifest.get("eventSubscriptions")?.mapNotNull { it.asText() }.orEmpty()
        return (capabilities.map { "capability:$it" } +
            egress.map { "egress:$it" } +
            endpoints +
            events.map { "event:$it" }).toSet()
        }

    /**
     * Declared by a deployment descriptor, never served by a host. All three conditions, not
     * `manifestJson == null` alone: a row with a null manifest because it predates that column must
     * keep being pushed.
     */
    val isPlaceholder: Boolean
        get() = manifestJson == null &&
            contentHash == null &&
            status == ExternalPluginDefinitionStatus.UNAVAILABLE
}
