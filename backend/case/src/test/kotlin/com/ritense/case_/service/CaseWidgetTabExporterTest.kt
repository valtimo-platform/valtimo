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

package com.ritense.case_.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabId
import com.ritense.case.domain.CaseTabType
import com.ritense.case.service.CaseTabService
import com.ritense.case_.rest.dto.CaseWidgetTabDto
import com.ritense.case_.widget.custom.CustomCaseWidgetDto
import com.ritense.case_.widget.custom.CustomWidgetProperties
import com.ritense.case_.widget.externalplugin.ExternalPluginCaseWidgetDto
import com.ritense.case_.widget.externalplugin.ExternalPluginWidgetProperties
import com.ritense.exporter.request.DocumentDefinitionExportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

class CaseWidgetTabExporterTest {

    private val objectMapper = jacksonObjectMapper()
    private val caseTabService = mock<CaseTabService>()
    private val caseWidgetService = mock<CaseWidgetService>()
    private val resolver = mock<ExternalPluginCaseWidgetResolver>()

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

    @Test
    fun `stamps the plugin id and version on external-plugin widgets in the export`() {
        val configurationId = UUID.randomUUID()
        val exporter = CaseWidgetTabExporter(objectMapper, caseTabService, caseWidgetService, Optional.of(resolver))

        whenever(caseTabService.getCaseTabs(caseDefinitionId)).thenReturn(listOf(widgetsTab()))
        whenever(caseWidgetService.getWidgetTab(caseDefinitionId, "widgets-tab")).thenReturn(
            CaseWidgetTabDto(
                caseDefinitionKey = "my-case",
                caseDefinitionVersionTag = "1.0.0",
                key = "widgets-tab",
                widgets = listOf(externalPluginWidgetDto(configurationId), customWidgetDto()),
            )
        )
        whenever(resolver.resolvePluginDefinition(configurationId))
            .thenReturn(ExternalPluginTabDefinition("case-summary", "0.1.0"))

        val result = exporter.export(DocumentDefinitionExportRequest("my-case", caseDefinitionId))

        val exported = objectMapper.readTree(result.exportFiles.single().content)
        val widgets = exported[0]["widgets"]
        val externalWidget = widgets.single { it["type"].asText() == "external-plugin" }
        assertThat(externalWidget["properties"]["configurationId"].asText()).isEqualTo(configurationId.toString())
        assertThat(externalWidget["properties"]["pluginDefinitionKey"].asText()).isEqualTo("case-summary")
        assertThat(externalWidget["properties"]["pluginDefinitionVersion"].asText()).isEqualTo("0.1.0")

        // Non-external widgets are untouched — no plugin identity noise.
        val customWidget = widgets.single { it["type"].asText() == "custom" }
        assertThat(customWidget["properties"].has("pluginDefinitionKey")).isFalse()
    }

    @Test
    fun `leaves the widget unchanged when the resolver cannot resolve the plugin definition`() {
        val configurationId = UUID.randomUUID()
        val exporter = CaseWidgetTabExporter(objectMapper, caseTabService, caseWidgetService, Optional.of(resolver))

        whenever(caseTabService.getCaseTabs(caseDefinitionId)).thenReturn(listOf(widgetsTab()))
        whenever(caseWidgetService.getWidgetTab(caseDefinitionId, "widgets-tab")).thenReturn(
            CaseWidgetTabDto(
                caseDefinitionKey = "my-case",
                caseDefinitionVersionTag = "1.0.0",
                key = "widgets-tab",
                widgets = listOf(externalPluginWidgetDto(configurationId)),
            )
        )
        whenever(resolver.resolvePluginDefinition(configurationId)).thenReturn(null)

        val result = exporter.export(DocumentDefinitionExportRequest("my-case", caseDefinitionId))

        val exported = objectMapper.readTree(result.exportFiles.single().content)
        val externalWidget = exported[0]["widgets"].single()
        assertThat(externalWidget["properties"].has("pluginDefinitionKey")).isFalse()
    }

    @Test
    fun `works without the external-plugin resolver on the classpath`() {
        val configurationId = UUID.randomUUID()
        val exporter = CaseWidgetTabExporter(objectMapper, caseTabService, caseWidgetService, Optional.empty())

        whenever(caseTabService.getCaseTabs(caseDefinitionId)).thenReturn(listOf(widgetsTab()))
        whenever(caseWidgetService.getWidgetTab(caseDefinitionId, "widgets-tab")).thenReturn(
            CaseWidgetTabDto(
                caseDefinitionKey = "my-case",
                caseDefinitionVersionTag = "1.0.0",
                key = "widgets-tab",
                widgets = listOf(externalPluginWidgetDto(configurationId)),
            )
        )

        val result = exporter.export(DocumentDefinitionExportRequest("my-case", caseDefinitionId))

        val exported = objectMapper.readTree(result.exportFiles.single().content)
        val externalWidget = exported[0]["widgets"].single()
        assertThat(externalWidget["properties"]["configurationId"].asText()).isEqualTo(configurationId.toString())
        assertThat(externalWidget["properties"].has("pluginDefinitionKey")).isFalse()
    }

    private fun widgetsTab() = CaseTab(
        id = CaseTabId(caseDefinitionId, "widgets-tab"),
        name = "Widgets",
        tabOrder = 0,
        type = CaseTabType.WIDGETS,
        contentKey = "widgets-tab",
    )

    private fun externalPluginWidgetDto(configurationId: UUID) = ExternalPluginCaseWidgetDto(
        key = "summary-widget",
        title = "Summary",
        icon = null,
        color = null,
        width = 2,
        highContrast = false,
        isCompact = null,
        actions = emptyList(),
        displayConditions = emptyList(),
        properties = ExternalPluginWidgetProperties(
            configurationId = configurationId,
            bundleKey = "summary-widget",
        ),
    )

    private fun customWidgetDto() = CustomCaseWidgetDto(
        key = "custom-widget",
        title = "Custom",
        icon = null,
        color = null,
        width = 2,
        highContrast = false,
        isCompact = null,
        actions = emptyList(),
        displayConditions = emptyList(),
        properties = CustomWidgetProperties(componentKey = "my-component"),
    )
}
