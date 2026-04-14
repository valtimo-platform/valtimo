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

package com.ritense.case.service

import CaseDefinitionDto
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.ritense.case.web.rest.dto.CaseDefinitionImportPreviewResponse
import com.ritense.case.web.rest.dto.PluginConfigurationPreviewDto
import com.ritense.importer.exception.ImportServiceException
import com.ritense.valtimo.contract.plugin.PluginConfigurationExistenceChecker
import java.io.InputStream
import java.util.UUID
import java.util.zip.ZipInputStream

class CaseDefinitionImportPreviewService(
    private val objectMapper: ObjectMapper,
    private val pluginConfigurationExistenceChecker: PluginConfigurationExistenceChecker?,
) {
    fun preview(inputStream: InputStream): CaseDefinitionImportPreviewResponse {
        val (caseDefContent, processLinkEntries) = scanZip(inputStream)

        val content = caseDefContent
            ?: throw ImportServiceException("No .case-definition.json found in ZIP")
        val dto = objectMapper.readValue(content, CaseDefinitionDto::class.java)

        val pluginConfigs = extractPluginConfigurations(processLinkEntries)

        return CaseDefinitionImportPreviewResponse(
            key = dto.key,
            name = dto.name,
            versionTag = dto.versionTag,
            isFinal = dto.final,
            pluginConfigurations = pluginConfigs,
        )
    }

    private fun scanZip(inputStream: InputStream): Pair<ByteArray?, List<ProcessLinkZipEntry>> {
        var caseDefContent: ByteArray? = null
        val processLinkEntries = mutableListOf<ProcessLinkZipEntry>()

        ZipInputStream(inputStream).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) {
                    when {
                        entry.name.matches(CASE_DEFINITION_REGEX) && caseDefContent == null -> {
                            caseDefContent = zis.readBytes()
                        }
                        entry.name.matches(PROCESS_LINK_REGEX) -> {
                            val match = PROCESS_LINK_REGEX.matchEntire(entry.name)!!
                            val processDefinitionKey = match.groupValues[1]
                            processLinkEntries.add(
                                ProcessLinkZipEntry(processDefinitionKey, zis.readBytes())
                            )
                        }
                    }
                }
                entry = zis.nextEntry
            }
        }

        return Pair(caseDefContent, processLinkEntries)
    }

    private fun extractPluginConfigurations(
        entries: List<ProcessLinkZipEntry>
    ): List<PluginConfigurationPreviewDto> {
        val result = mutableListOf<PluginConfigurationPreviewDto>()

        for (entry in entries) {
            val jsonTree = try {
                objectMapper.readTree(entry.content.toString(Charsets.UTF_8))
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
                    PluginConfigurationPreviewDto(
                        pluginConfigurationId = pluginConfigId,
                        pluginDefinitionKey = pluginDefinitionKey,
                        pluginActionDefinitionKey = pluginActionDefinitionKey,
                        processDefinitionKey = entry.processDefinitionKey,
                        activityId = activityId,
                        existsInTargetEnvironment = exists,
                    )
                )
            }
        }

        return result
    }

    private data class ProcessLinkZipEntry(
        val processDefinitionKey: String,
        val content: ByteArray,
    )

    private companion object {
        val CASE_DEFINITION_REGEX =
            """.*/?case/definition/[^/]+\.case-definition\.json""".toRegex()
        val PROCESS_LINK_REGEX =
            """.*/?process-link/(?:.*/)?(.+)\.process-link\.json""".toRegex()
    }
}
