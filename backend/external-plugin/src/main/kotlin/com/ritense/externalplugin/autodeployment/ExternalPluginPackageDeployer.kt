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

package com.ritense.externalplugin.autodeployment

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.externalplugin.service.ExternalPluginPackageInstaller
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.io.ResourceLoader
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

@Component
@SkipComponentScan
class ExternalPluginPackageDeployer(
    private val resourceLoader: ResourceLoader,
    private val hostService: ExternalPluginHostService,
    private val objectMapper: ObjectMapper,
) : ExternalPluginPackageInstaller {
    private val pending = ConcurrentHashMap<UUID, List<PackageDeploymentDto>>()

    /** Without this the 60s poll loop would re-POST every package, every cycle, to every host. */
    private val settled = ConcurrentHashMap.newKeySet<Pair<UUID, String>>()

    fun register(hostId: UUID, packages: List<PackageDeploymentDto>) {
        if (packages.isEmpty()) pending.remove(hostId) else pending[hostId] = packages
    }

    fun clear() {
        pending.clear()
        settled.clear()
    }

    override fun deployPending(host: ExternalPluginHost) {
        val packages = pending[host.id] ?: return
        packages.forEach { pkg ->
            val key = host.id to pkg.resource
            if (key in settled) return@forEach
            try {
                if (upload(host, pkg)) settled += key
            } catch (e: Exception) {
                logger.warn(e) {
                    "Failed to upload plugin package '${pkg.resource}' to external plugin host " +
                        "${host.id} (${host.baseUrl}); retrying on the next discovery cycle"
                }
            }
        }
    }

    private fun upload(host: ExternalPluginHost, pkg: PackageDeploymentDto): Boolean {
        val resource = resourceLoader.getResource(pkg.resource)
        if (!resource.exists()) {
            logger.error {
                "Plugin package '${pkg.resource}' declared for external plugin host ${host.id} was " +
                    "not found on the classpath"
            }
            return true
        }
        val fileName = resource.filename ?: "plugin.zip"
        val bytes = resource.inputStream.use { it.readBytes() }

        return try {
            hostService.uploadPlugin(host.id, fileName, bytes, pkg.overwrite)
            logger.info { "Uploaded plugin package '$fileName' to external plugin host ${host.id}" }
            true
        } catch (e: HttpClientErrorException.Conflict) {
            val body = parseBody(e.responseBodyAsByteArray)
            val current = body?.get("currentContentHash")?.asText()
            val uploaded = body?.get("uploadedContentHash")?.asText()
            if (current != null && current == uploaded) {
                logger.debug {
                    "Plugin package '$fileName' is already installed on host ${host.id} with " +
                        "identical content ($current)"
                }
            } else {
                logger.warn {
                    "Plugin package '$fileName' differs from the version installed on host " +
                        "${host.id} (installed $current, descriptor $uploaded) and was not uploaded. " +
                        "Replacing plugin code an admin already accepted is an explicit decision: " +
                        "set \"overwrite\": true on the package, or upload it through the UI."
                }
            }
            true
        }
    }

    private fun parseBody(bytes: ByteArray): JsonNode? = if (bytes.isEmpty()) {
        null
    } else {
        runCatching { objectMapper.readTree(bytes) }.getOrNull()
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
