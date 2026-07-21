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

package com.ritense.externalplugin.preview

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.valtimo.contract.importer.ImportPreviewContribution
import com.ritense.valtimo.contract.importer.ImportPreviewContribution.Companion.SOURCE_EXTERNAL
import com.ritense.valtimo.contract.importer.ImportPreviewContributor
import java.util.UUID

/**
 * Surfaces external-plugin configuration references in the case-definition import preview, mirroring
 * `PluginConfigurationImportPreviewContributor` (embedded plugins) for the two places an
 * `externalPluginConfigurationId` can appear: `*.process-link.json` (`external_plugin` /
 * `external_plugin_task_form` links) and `*.case-tab.json` (`EXTERNAL_PLUGIN` tabs, whose config id
 * is embedded in `contentKey` as `"<configId>[:<bundleKey>]"`).
 */
class ExternalPluginImportPreviewContributor(
    private val objectMapper: ObjectMapper,
    private val configurationRepository: ExternalPluginConfigurationRepository,
) : ImportPreviewContributor {

    override fun contributePreview(zipEntries: Map<String, ByteArray>): List<ImportPreviewContribution> {
        val result = mutableListOf<ImportPreviewContribution>()
        for ((fileName, content) in zipEntries) {
            when {
                PROCESS_LINK_REGEX.matches(fileName) -> result += contributeFromProcessLink(fileName, content)
                CASE_TAB_REGEX.matches(fileName) -> result += contributeFromCaseTab(fileName, content)
            }
        }
        return result
    }

    private fun contributeFromProcessLink(fileName: String, content: ByteArray): List<ImportPreviewContribution> {
        val match = PROCESS_LINK_REGEX.matchEntire(fileName) ?: return emptyList()
        val processDefinitionKey = match.groupValues[1]

        val jsonTree = try {
            objectMapper.readTree(content.toString(Charsets.UTF_8))
        } catch (_: Exception) {
            return emptyList()
        }
        if (jsonTree !is ArrayNode) return emptyList()

        val result = mutableListOf<ImportPreviewContribution>()
        for (node in jsonTree) {
            val processLinkType = node.path("processLinkType").asText(null) ?: continue
            if (processLinkType != "external_plugin" && processLinkType != "external_plugin_task_form") continue

            val referenceType = node.path("referenceType").asText("FIXED")
            if (referenceType != "FIXED") continue

            val configIdText = node.path("externalPluginConfigurationId").asText(null) ?: continue
            val configId = configIdText.toUuidOrNull() ?: continue

            val pluginDefinitionKey = node.path("pluginDefinitionKey").asText(null)
            val pluginDefinitionVersion = node.path("pluginVersion").asText(null)
            val activityId = node.path("activityId").asText(null) ?: continue
            val actionKey = node.path("actionKey").asText(processLinkType)

            result.add(
                ImportPreviewContribution(
                    pluginConfigurationId = configId,
                    pluginDefinitionKey = pluginDefinitionKey,
                    pluginActionDefinitionKey = actionKey,
                    processDefinitionKey = processDefinitionKey,
                    activityId = activityId,
                    existsInTargetEnvironment = configurationRepository.existsById(configId),
                    source = SOURCE_EXTERNAL,
                    pluginDefinitionVersion = pluginDefinitionVersion,
                )
            )
        }
        return result
    }

    private fun contributeFromCaseTab(fileName: String, content: ByteArray): List<ImportPreviewContribution> {
        val jsonTree = try {
            objectMapper.readTree(content.toString(Charsets.UTF_8))
        } catch (_: Exception) {
            return emptyList()
        }
        if (jsonTree !is ArrayNode) return emptyList()

        val result = mutableListOf<ImportPreviewContribution>()
        for (node in jsonTree) {
            val type = node.path("type").asText(null) ?: continue
            if (type != "external_plugin") continue

            val contentKey = node.path("contentKey").asText(null) ?: continue
            val configId = contentKey.substringBefore(':').toUuidOrNull() ?: continue
            val tabKey = node.path("key").asText(fileName)

            result.add(
                ImportPreviewContribution(
                    pluginConfigurationId = configId,
                    pluginDefinitionKey = null,
                    pluginActionDefinitionKey = "case-tab",
                    processDefinitionKey = fileName,
                    activityId = tabKey,
                    existsInTargetEnvironment = configurationRepository.existsById(configId),
                    source = SOURCE_EXTERNAL,
                    pluginDefinitionVersion = null,
                )
            )
        }
        return result
    }

    private fun String.toUuidOrNull(): UUID? = try {
        UUID.fromString(this)
    } catch (_: IllegalArgumentException) {
        null
    }

    private companion object {
        val PROCESS_LINK_REGEX = """.*/?process-link/(?:.*/)?(.+)\.process-link\.json""".toRegex()
        val CASE_TAB_REGEX = """.*/?case/tab/([^/]+)\.case-tab\.json""".toRegex()
    }
}
