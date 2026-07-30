/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case.deployment.CaseTabDto
import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabId
import com.ritense.case.domain.CaseTabType
import com.ritense.case.repository.CaseTabRepository
import com.ritense.case_.domain.tab.CaseExternalPluginTab
import com.ritense.case_.service.event.CaseTabCreatedEvent
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_TAB
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class CaseTabImporter(
    private val objectMapper: ObjectMapper,
    private val caseTabRepository: CaseTabRepository,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val pluginConfigurationMappingResolvers: List<PluginConfigurationMappingResolver> = emptyList(),
) : Importer {
    override fun type() = CASE_TAB

    override fun dependsOn() = setOf(DOCUMENT_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        deploy(request)
    }

    /**
     * A case tab is not a process link, so it gets no detection from the process-link importer.
     * Trigger an in-transaction recheck here — for external-plugin tabs this is what raises the
     * configuration issue when the tab references a plugin configuration missing in this environment.
     */
    override fun afterImport(request: ImportRequest) {
        val caseDefinitionId = request.caseDefinitionId ?: return
        pluginConfigurationMappingResolvers.forEach { it.recheckIssuesForCaseDefinition(caseDefinitionId) }
    }

    private fun deploy(request: ImportRequest) {
        val caseDefinitionId = request.caseDefinitionId!!
        val fileContent = request.content.toString(Charsets.UTF_8)
        val tabs = try {
            objectMapper.readValue(fileContent, object : TypeReference<List<CaseTabDto>>() {})
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to parse file content as valid case widget tabs: ${e.message}", e)
        }

        val savedTabs = tabs.mapIndexed { index, tab ->
            val contentKey = if (tab.type == CaseTabType.EXTERNAL_PLUGIN) {
                remapExternalPluginContentKey(tab.contentKey, request.pluginConfigurationMappings)
            } else {
                tab.contentKey
            }

            val saved = caseTabRepository.save(
                CaseTab(
                    id = CaseTabId(caseDefinitionId, tab.key),
                    name = tab.name,
                    tabOrder = index,
                    type = tab.type,
                    contentKey = contentKey,
                    showTasks = tab.showTasks
                )
            )
            saved to tab
        }

        // Carry the export's plugin identity onto the event so the EXTERNAL_PLUGIN side row can
        // persist it — this is what keeps a tab dangling on import (its configuration missing here)
        // identifiable in the repair panel afterwards.
        savedTabs
            .filter { (saved, _) -> saved.type == CaseTabType.EXTERNAL_PLUGIN }
            .forEach { (saved, dto) ->
                applicationEventPublisher.publishEvent(
                    CaseTabCreatedEvent(saved, dto.pluginDefinitionKey, dto.pluginVersion)
                )
            }
    }

    /**
     * `contentKey` must stay non-blank ([CaseTab]'s invariant), so a mapping value of `null` (admin
     * left the tab's configuration unmapped) leaves the original, now-dangling id in place rather
     * than producing an empty/invalid content key.
     */
    private fun remapExternalPluginContentKey(contentKey: String, mappings: Map<UUID, UUID?>?): String {
        if (mappings.isNullOrEmpty()) {
            return contentKey
        }

        val (originalConfigId, bundleKey) = CaseExternalPluginTab.parseContentKeyOrNull(contentKey)
            ?: return contentKey

        val mappedConfigId = mappings[originalConfigId] ?: return contentKey

        return CaseExternalPluginTab.formatContentKey(mappedConfigId, bundleKey)
    }

    private companion object {
        private val FILENAME_REGEX = """/case/tab/([^/]+)\.case-tab\.json""".toRegex()
    }
}