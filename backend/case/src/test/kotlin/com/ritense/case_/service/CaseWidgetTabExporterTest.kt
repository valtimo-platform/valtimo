/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import com.fasterxml.jackson.annotation.JsonTypeName
import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabId
import com.ritense.case.domain.CaseTabType
import com.ritense.case.service.CaseTabService
import com.ritense.case_.rest.dto.CaseWidgetTabDto
import com.ritense.case_.rest.dto.CaseWidgetTabWidgetDto
import com.ritense.exporter.request.DocumentDefinitionExportRequest
import com.ritense.exporter.request.ExportRequest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.widget.domain.WidgetAction
import com.ritense.widget.domain.WidgetColor
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class CaseWidgetTabExporterTest(
    @Mock private val caseTabService: CaseTabService,
    @Mock private val caseWidgetService: CaseWidgetService,
) {
    private val exporter = CaseWidgetTabExporter(MapperSingleton.get(), caseTabService, caseWidgetService)

    @Test
    fun `should export the resources referred to by the widgets`() {
        val caseDefinitionId = CaseDefinitionId.of("some-case-type", "1.1.1")
        whenever(caseTabService.getCaseTabs(caseDefinitionId)).thenReturn(
            listOf(
                CaseTab(CaseTabId(caseDefinitionId, "my-widget-tab"), "My widget tab", 0, CaseTabType.WIDGETS, "-"),
                CaseTab(CaseTabId(caseDefinitionId, "my-standard-tab"), "Notes", 1, CaseTabType.STANDARD, "notes"),
            )
        )
        whenever(caseWidgetService.getWidgetTab(caseDefinitionId, "my-widget-tab")).thenReturn(
            CaseWidgetTabDto(key = "my-widget-tab", widgets = listOf(TestCaseWidgetDto()))
        )

        val exportResult = exporter.export(DocumentDefinitionExportRequest("some-case-type", caseDefinitionId))

        assertThat(exportResult.exportFiles).singleElement()
        assertThat(exportResult.relatedRequests).containsExactly(TestExportRequest(caseDefinitionId))
    }

    @JsonTypeName("test")
    private data class TestCaseWidgetDto(
        override val key: String = "my-widget",
        override val title: String = "My widget",
        override val icon: String? = null,
        override val color: WidgetColor? = null,
        override val width: Int = 1,
        override val highContrast: Boolean = false,
        override val isCompact: Boolean? = false,
        override val actions: List<WidgetAction>? = emptyList(),
        override val displayConditions: List<Condition<*>> = emptyList(),
    ) : CaseWidgetTabWidgetDto {
        override fun getRelatedExportRequests(caseDefinitionId: CaseDefinitionId) =
            setOf<ExportRequest>(TestExportRequest(caseDefinitionId))
    }

    private data class TestExportRequest(
        override val caseDefinitionId: CaseDefinitionId
    ) : ExportRequest()
}
