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
import com.ritense.widget.domain.WidgetColor
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.UUID

class ExternalPluginCaseWidgetMapperTest {

    private val mapper = ExternalPluginCaseWidgetMapper()

    @Test
    fun `toEntity unpacks the properties into dedicated columns and sets order from the index`() {
        val configurationId = UUID.randomUUID()
        val dto = ExternalPluginCaseWidgetDto(
            key = "summary-widget",
            title = "Summary",
            icon = "mdi-account",
            color = WidgetColor.BLUE,
            width = 2,
            highContrast = false,
            isCompact = true,
            actions = emptyList(),
            displayConditions = emptyList(),
            properties = ExternalPluginWidgetProperties(
                configurationId = configurationId,
                bundleKey = "summary-widget",
                pluginDefinitionKey = "case-summary",
                pluginDefinitionVersion = "0.1.0",
            ),
        )

        val entity = mapper.toEntity(dto, 3)

        assertThat(entity.id.key).isEqualTo("summary-widget")
        assertThat(entity.order).isEqualTo(3)
        assertThat(entity.externalPluginConfigurationId).isEqualTo(configurationId)
        assertThat(entity.bundleKey).isEqualTo("summary-widget")
        assertThat(entity.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(entity.pluginDefinitionVersion).isEqualTo("0.1.0")
    }

    @Test
    fun `toEntity defaults color to WHITE when none is given`() {
        val dto = baseDto(color = null)

        assertThat(mapper.toEntity(dto, 0).color).isEqualTo(WidgetColor.WHITE)
    }

    @Test
    fun `toDto packs the columns back into properties`() {
        val configurationId = UUID.randomUUID()
        val entity = ExternalPluginCaseWidget(
            id = CaseWidgetTabWidgetId("summary-widget"),
            title = "Summary",
            icon = "mdi-account",
            color = WidgetColor.BLUE,
            order = 0,
            width = 2,
            highContrast = false,
            isCompact = true,
            actions = emptyList(),
            displayConditions = emptyList(),
            externalPluginConfigurationId = configurationId,
            bundleKey = "summary-widget",
            pluginDefinitionKey = "case-summary",
            pluginDefinitionVersion = "0.1.0",
        )

        val dto = mapper.toDto(entity)

        assertThat(dto.key).isEqualTo("summary-widget")
        assertThat(dto.title).isEqualTo("Summary")
        assertThat(dto.color).isEqualTo(WidgetColor.BLUE)
        assertThat(dto.width).isEqualTo(2)
        assertThat(dto.isCompact).isTrue()
        assertThat(dto.properties.configurationId).isEqualTo(configurationId)
        assertThat(dto.properties.bundleKey).isEqualTo("summary-widget")
        assertThat(dto.properties.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(dto.properties.pluginDefinitionVersion).isEqualTo("0.1.0")
    }

    @Test
    fun `entity to dto to entity round-trips the config, bundle and plugin identity`() {
        val configurationId = UUID.randomUUID()
        val entity = ExternalPluginCaseWidget(
            id = CaseWidgetTabWidgetId("summary-widget"),
            title = "Summary",
            icon = null,
            color = WidgetColor.WHITE,
            order = 5,
            width = 4,
            highContrast = true,
            isCompact = null,
            actions = emptyList(),
            displayConditions = emptyList(),
            externalPluginConfigurationId = configurationId,
            bundleKey = "summary-widget",
            pluginDefinitionKey = "case-summary",
            pluginDefinitionVersion = "0.1.0",
        )

        val roundTripped = mapper.toEntity(mapper.toDto(entity), 5)

        assertThat(roundTripped.externalPluginConfigurationId).isEqualTo(configurationId)
        assertThat(roundTripped.bundleKey).isEqualTo("summary-widget")
        assertThat(roundTripped.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(roundTripped.pluginDefinitionVersion).isEqualTo("0.1.0")
        assertThat(roundTripped.width).isEqualTo(4)
        assertThat(roundTripped.highContrast).isTrue()
    }

    private fun baseDto(color: WidgetColor? = null) = ExternalPluginCaseWidgetDto(
        key = "summary-widget",
        title = "Summary",
        icon = null,
        color = color,
        width = 2,
        highContrast = false,
        isCompact = null,
        actions = emptyList(),
        displayConditions = emptyList(),
        properties = ExternalPluginWidgetProperties(
            configurationId = UUID.randomUUID(),
            bundleKey = "summary-widget",
        ),
    )
}
