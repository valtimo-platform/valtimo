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
import com.ritense.case.web.rest.dto.CaseDefinitionImportPreviewResponse
import com.ritense.case.web.rest.dto.PluginConfigurationPreviewDto
import com.ritense.importer.exception.ImportServiceException
import com.ritense.valtimo.contract.importer.ImportPreviewContributor
import java.io.InputStream
import java.util.zip.ZipInputStream

class CaseDefinitionImportPreviewService(
    private val objectMapper: ObjectMapper,
    private val importPreviewContributors: List<ImportPreviewContributor>,
) {
    fun preview(inputStream: InputStream): CaseDefinitionImportPreviewResponse {
        val zipEntries = readZipEntries(inputStream)

        val caseDefContent = zipEntries.entries
            .firstOrNull { it.key.matches(CASE_DEFINITION_REGEX) }
            ?.value
            ?: throw ImportServiceException("No .case-definition.json found in ZIP")

        val dto = objectMapper.readValue(caseDefContent, CaseDefinitionDto::class.java)

        val pluginConfigs = importPreviewContributors.flatMap { it.contributePreview(zipEntries) }

        return CaseDefinitionImportPreviewResponse(
            key = dto.key,
            name = dto.name,
            versionTag = dto.versionTag,
            isFinal = dto.final,
            pluginConfigurations = pluginConfigs.map {
                PluginConfigurationPreviewDto(
                    pluginConfigurationId = it.pluginConfigurationId,
                    pluginDefinitionKey = it.pluginDefinitionKey,
                    pluginActionDefinitionKey = it.pluginActionDefinitionKey,
                    processDefinitionKey = it.processDefinitionKey,
                    activityId = it.activityId,
                    existsInTargetEnvironment = it.existsInTargetEnvironment,
                )
            },
        )
    }

    private fun readZipEntries(inputStream: InputStream): Map<String, ByteArray> {
        val entries = mutableMapOf<String, ByteArray>()

        ZipInputStream(inputStream).use { zis ->
            var entry = zis.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) {
                    entries[entry.name] = zis.readBytes()
                }
                entry = zis.nextEntry
            }
        }

        return entries
    }

    private companion object {
        val CASE_DEFINITION_REGEX =
            """.*/?case/definition/[^/]+\.case-definition\.json""".toRegex()
    }
}
