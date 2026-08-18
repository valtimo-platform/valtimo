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

package com.ritense.externalplugin.web.rest.dto

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.externalplugin.compatibility.CompatibilityResult
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import java.util.UUID

/** Echoes the pending content hash the admin reviewed — see `acceptDefinitionContent`. */
data class AcceptContentRequest(
    val contentHash: String,
)

data class DefinitionResponse(
    val id: UUID,
    val pluginId: String,
    val version: String,
    val name: String?,
    val description: String?,
    val provider: String?,
    val hostId: UUID,
    val baseUrl: String,
    val status: ExternalPluginDefinitionStatus,
    val configurationSchema: JsonNode?,
    val manifest: JsonNode?,
    /**
     * Declared compatibility bounds (from the manifest's `compatibility` block) and the resolved
     * outcome of comparing them against the running GZAC version. [compatible] is `true` when the
     * plugin targets this version (or when it could not be judged); when `false` the management UI
     * surfaces a non-blocking warning. [currentGzacVersion] is the running version the check used,
     * or null when it could not be determined.
     */
    val minGzacVersion: String?,
    val maxGzacVersion: String?,
    val currentGzacVersion: String?,
    val compatible: Boolean,
    /**
     * Absolute URL the frontend can fetch the logo from, or null when the plugin shipped no logo.
     * The host serves the file at `GET /plugins/:id/:version/logo`; this URL composes the host
     * `baseUrl` with the version so the management UI can use it directly in `<img src>`.
     */
    val logoUrl: String?,
    /**
     * The package content hash pinned at discovery, the hash the host serves *now* when it
     * differs, and whether an admin must re-accept before the plugin runs again. Re-acceptance is
     * a deliberately API-only recovery act (no management-UI flow): the caller passes
     * [pendingContentHash] back on `POST /definition/{id}/accept-content` to confirm which package
     * it reviewed.
     */
    val contentHash: String?,
    val pendingContentHash: String?,
    val requiresReacceptance: Boolean,
) {
    companion object {
        fun from(definition: ExternalPluginDefinition, compatibility: CompatibilityResult): DefinitionResponse {
            val hasLogo = definition.manifestJson?.get("logo")?.isTextual == true
            return DefinitionResponse(
                id = definition.id,
                pluginId = definition.pluginId,
                version = definition.version,
                name = definition.name,
                description = definition.description,
                provider = definition.provider,
                hostId = definition.hostId,
                baseUrl = definition.baseUrl,
                status = definition.status,
                configurationSchema = definition.configSchema,
                manifest = definition.manifestJson,
                minGzacVersion = definition.minGzacVersion,
                maxGzacVersion = definition.maxGzacVersion,
                currentGzacVersion = compatibility.currentGzacVersion,
                compatible = compatibility.compatible,
                logoUrl = if (hasLogo) "${definition.baseUrl}/${definition.version}/logo" else null,
                contentHash = definition.contentHash,
                pendingContentHash = definition.pendingContentHash,
                requiresReacceptance = definition.requiresReacceptance,
            )
        }
    }
}
