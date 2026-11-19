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

package com.ritense.valtimo.processlink.preview

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.ritense.valtimo.contract.importer.ImportPreviewContribution
import com.ritense.valtimo.contract.importer.ImportPreviewContributor
import com.ritense.valtimo.contract.plugin.PluginConfigurationExistenceChecker
import java.util.UUID

class PluginConfigurationImportPreviewContributor(
    private val objectMapper: ObjectMapper,
    private val pluginConfigurationExistenceChecker: PluginConfigurationExistenceChecker?,
) : ImportPreviewContributor {

    override fun contributePreview(zipEntries: Map<String, ByteArray>): List<ImportPreviewContribution> {
        val result = mutableListOf<ImportPreviewContribution>()

        for ((fileName, content) in zipEntries) {
            val match = PROCESS_LINK_REGEX.matchEntire(fileName) ?: continue
            val processDefinitionKey = match.groupValues[1]

            val jsonTree = try {
                objectMapper.readTree(content.toString(Charsets.UTF_8))
            } catch (_: Exception) {
                continue
            }

            if (jsonTree !is ArrayNode) continue

            for (node in jsonTree) {
                val processLinkType = node.path("processLinkType").asText(null) ?: continue
                if (processLinkType != "plugin") continue

                val referenceType = node.path("referenceType").asText("FIXED")
                if (referenceType != "FIXED") continue

                val pluginConfigIdText = node.path("pluginConfigurationId").asText(null) ?: continue
                val pluginConfigId = try {
                    UUID.fromString(pluginConfigIdText)
                } catch (_: IllegalArgumentException) {
                    continue
                }

                val pluginDefinitionKey = node.path("pluginDefinitionKey").asText(null)
                val pluginActionDefinitionKey = node.path("pluginActionDefinitionKey").asText(null) ?: continue
                val activityId = node.path("activityId").asText(null) ?: continue

                val exists = pluginConfigurationExistenceChecker?.exists(pluginConfigId) ?: false

                result.add(
                    ImportPreviewContribution(
                        pluginConfigurationId = pluginConfigId,
                        pluginDefinitionKey = pluginDefinitionKey,
                        pluginActionDefinitionKey = pluginActionDefinitionKey,
                        processDefinitionKey = processDefinitionKey,
                        activityId = activityId,
                        existsInTargetEnvironment = exists,
                    )
                )
            }
        }

        return result
    }

    private companion object {
        val PROCESS_LINK_REGEX =
            """.*/?process-link/(?:.*/)?(.+)\.process-link\.json""".toRegex()
    }
}
