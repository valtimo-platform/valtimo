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

package com.ritense.case_.widget.externalplugin

import com.ritense.case_.domain.tab.CaseWidgetTabWidgetId
import com.ritense.case_.rest.dto.ExternalPluginWidgetContentDto
import com.ritense.case_.service.ExternalPluginCaseWidgetResolver
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.widget.domain.WidgetColor
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.Pageable
import java.util.Optional
import java.util.UUID

class ExternalPluginCaseWidgetDataProviderTest {

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")
    private val documentId = UUID.randomUUID()

    @Test
    fun `supports only external-plugin widgets`() {
        val provider = ExternalPluginCaseWidgetDataProvider(Optional.empty())

        assertThat(provider.supports(widget(UUID.randomUUID()))).isTrue()
        assertThat(provider.supports("not a widget")).isFalse()
    }

    @Test
    fun `getData resolves the bundle url and builds the context`() {
        val configurationId = UUID.randomUUID()
        val resolver = mock<ExternalPluginCaseWidgetResolver>()
        whenever(resolver.resolveBundleUrl(configurationId, "summary-widget"))
            .thenReturn("http://host/plugins/case-summary/0.1.0/bundles/case-widget.html")
        val provider = ExternalPluginCaseWidgetDataProvider(Optional.of(resolver))

        val result = provider.getData(documentId, widget(configurationId), Pageable.unpaged(), caseDefinitionId)

        assertThat(result).isInstanceOf(ExternalPluginWidgetContentDto::class.java)
        result as ExternalPluginWidgetContentDto
        assertThat(result.bundleUrl).isEqualTo("http://host/plugins/case-summary/0.1.0/bundles/case-widget.html")
        assertThat(result.configurationId).isEqualTo(configurationId)
        assertThat(result.bundleKey).isEqualTo("summary-widget")
        assertThat(result.context.documentId).isEqualTo(documentId.toString())
        assertThat(result.context.caseDefinitionKey).isEqualTo("my-case")
        assertThat(result.context.caseDefinitionVersionTag).isEqualTo("1.0.0")
        assertThat(result.context.pluginConfigurationId).isEqualTo(configurationId.toString())
    }

    @Test
    fun `getData returns a null bundle url when the resolver is absent`() {
        val configurationId = UUID.randomUUID()
        val provider = ExternalPluginCaseWidgetDataProvider(Optional.empty())

        val result = provider.getData(documentId, widget(configurationId), Pageable.unpaged(), caseDefinitionId) as ExternalPluginWidgetContentDto

        assertThat(result.bundleUrl).isNull()
        assertThat(result.configurationId).isEqualTo(configurationId)
    }

    @Test
    fun `getData does not call the resolver for a dangling widget with no configuration`() {
        val resolver = mock<ExternalPluginCaseWidgetResolver>()
        val provider = ExternalPluginCaseWidgetDataProvider(Optional.of(resolver))

        val result = provider.getData(documentId, widget(null), Pageable.unpaged(), caseDefinitionId) as ExternalPluginWidgetContentDto

        assertThat(result.bundleUrl).isNull()
        assertThat(result.configurationId).isNull()
        assertThat(result.context.pluginConfigurationId).isNull()
        verify(resolver, never()).resolveBundleUrl(any(), any())
    }

    private fun widget(configurationId: UUID?) = ExternalPluginCaseWidget(
        id = CaseWidgetTabWidgetId("summary-widget"),
        title = "Summary",
        icon = null,
        color = WidgetColor.WHITE,
        order = 0,
        width = 2,
        highContrast = false,
        isCompact = null,
        actions = emptyList(),
        displayConditions = emptyList(),
        externalPluginConfigurationId = configurationId,
        bundleKey = "summary-widget",
        pluginDefinitionKey = "case-summary",
        pluginDefinitionVersion = "0.1.0",
    )
}
