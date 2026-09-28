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

package com.ritense.case_.service

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case.domain.CaseTabId
import com.ritense.case_.domain.tab.CaseWidgetTab
import com.ritense.case_.domain.tab.CaseWidgetTabWidget
import com.ritense.case_.repository.CaseWidgetTabRepository
import com.ritense.case_.rest.dto.CaseWidgetTabDto
import com.ritense.case_.rest.dto.CaseWidgetTabWidgetDto
import com.ritense.case_.widget.CaseWidgetMapper
import com.ritense.case_.widget.externalplugin.ExternalPluginCaseWidgetDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_TAB
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_WIDGET_TAB
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.FORM
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import com.ritense.valtimo.contract.validation.check
import jakarta.validation.Validator
import java.util.UUID

class CaseWidgetTabImporter(
    private val objectMapper: ObjectMapper,
    private val validator: Validator,
    private val caseWidgetTabRepository: CaseWidgetTabRepository,
    private val caseWidgetMappers: List<CaseWidgetMapper<CaseWidgetTabWidget, CaseWidgetTabWidgetDto>>,
    private val pluginConfigurationMappingResolvers: List<PluginConfigurationMappingResolver> = emptyList(),
) : Importer {
    override fun type() = CASE_WIDGET_TAB

    override fun dependsOn() = setOf(DOCUMENT_DEFINITION, CASE_TAB, FORM)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        return deploy(
            request.content.toString(Charsets.UTF_8),
            request.caseDefinitionId!!,
            request.pluginConfigurationMappings,
        )
    }

    /**
     * A case widget is not a process link, so it gets no detection from the process-link importer.
     * Trigger an in-transaction recheck here — for external-plugin widgets this is what raises the
     * configuration issue when a widget references a plugin configuration missing in this environment
     * (mirrors [CaseTabImporter.afterImport]).
     */
    override fun afterImport(request: ImportRequest) {
        val caseDefinitionId = request.caseDefinitionId ?: return
        pluginConfigurationMappingResolvers.forEach { it.recheckIssuesForCaseDefinition(caseDefinitionId) }
    }

    @JvmOverloads
    fun deploy(
        fileContent: String,
        caseDefinitionId: CaseDefinitionId,
        pluginConfigurationMappings: Map<UUID, UUID?>? = null,
    ) {
        val tabs = try {
            objectMapper.readValue(fileContent, object : TypeReference<List<CaseWidgetTabDto>>() {})
        } catch (e: Exception) {
            throw IllegalArgumentException("Failed to parse file content as valid case widget tabs: ${e.message}", e)
        }

        val remappedTabs = tabs.map { remapExternalPluginWidgets(it, pluginConfigurationMappings) }

        validator.check(remappedTabs)
        remappedTabs.forEach { it.validate(caseDefinitionId) }

        val toSave = remappedTabs.map { tab ->
            CaseWidgetTab(
                CaseTabId(
                    caseDefinitionId = caseDefinitionId,
                    key = tab.key
                ),
                widgets = tab.widgets.mapIndexed { index, widgetDto ->
                    caseWidgetMappers.first { mapper ->
                        mapper.supportedDtoType().isAssignableFrom(widgetDto::class.java)
                    }.toEntity(widgetDto, index)
                },
                widgetLayout = tab.widgetLayout
            )
        }

        caseWidgetTabRepository.saveAll(toSave)
    }

    /**
     * Applies the import wizard's plugin-configuration mapping to each `external-plugin` widget. A
     * non-null mapping value re-points the widget at a target configuration; a `null` mapping value
     * (admin left it unmapped) or a config id absent from the map leaves the original — now dangling —
     * id in place, exactly like [CaseTabImporter.remapExternalPluginContentKey]. Keeping the original
     * id (rather than nulling the column) is what lets the repair panel offer a mapping from that
     * source id later, and keeps dangling detection consistent with the tab surface (config id set
     * but not resolvable in this environment). The widget's design-time plugin identity is carried
     * separately in `plugin_definition_key`/`version` from the self-describing export.
     */
    private fun remapExternalPluginWidgets(
        tab: CaseWidgetTabDto,
        mappings: Map<UUID, UUID?>?,
    ): CaseWidgetTabDto {
        if (mappings.isNullOrEmpty()) return tab
        if (tab.widgets.none { it is ExternalPluginCaseWidgetDto }) return tab

        return tab.copy(
            widgets = tab.widgets.map { widget ->
                if (widget !is ExternalPluginCaseWidgetDto) {
                    widget
                } else {
                    val originalConfigId = widget.properties.configurationId
                    val mappedConfigId = originalConfigId?.let { mappings[it] } ?: return@map widget
                    widget.copy(
                        properties = widget.properties.copy(configurationId = mappedConfigId)
                    )
                }
            }
        )
    }

    private companion object {
        val FILENAME_REGEX = """/case/widget-tab/([^/]+)\.case-widget-tab\.json""".toRegex()
    }
}
