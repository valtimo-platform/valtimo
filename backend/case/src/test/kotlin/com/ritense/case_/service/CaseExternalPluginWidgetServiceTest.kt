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

import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabId
import com.ritense.case.domain.CaseTabType
import com.ritense.case.repository.CaseTabRepository
import com.ritense.case_.domain.tab.CaseWidgetTab
import com.ritense.case_.domain.tab.CaseWidgetTabWidget
import com.ritense.case_.domain.tab.CaseWidgetTabWidgetId
import com.ritense.case_.domain.tab.TestCaseWidgetTabWidget
import com.ritense.case_.repository.CaseWidgetTabRepository
import com.ritense.case_.repository.ExternalPluginCaseWidgetRepository
import com.ritense.case_.widget.TestCaseWidgetProperties
import com.ritense.case_.widget.externalplugin.ExternalPluginCaseWidget
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.widget.domain.WidgetColor
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.junit.jupiter.MockitoSettings
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.mockito.quality.Strictness
import java.util.Optional
import java.util.UUID

/**
 * Query/mutation surface the external-plugin module drives for case widgets (plan §13.7/§20): the
 * delete guard's usage lookup, the dangling-repair panel's listing, and the import remap. The case
 * module deliberately knows nothing about plugins, so it must expose *every* external-plugin widget —
 * including one whose configuration id is null after a dangling import — and never filter on
 * configuration existence itself.
 */
@ExtendWith(MockitoExtension::class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CaseExternalPluginWidgetServiceTest(
    @Mock private val externalPluginCaseWidgetRepository: ExternalPluginCaseWidgetRepository,
    @Mock private val caseWidgetTabRepository: CaseWidgetTabRepository,
    @Mock private val caseTabRepository: CaseTabRepository,
) {
    private lateinit var service: CaseExternalPluginWidgetService

    private val caseDefinitionId = CaseDefinitionId.of("my-case", "1.0.0")

    @BeforeEach
    fun before() {
        service = CaseExternalPluginWidgetService(
            externalPluginCaseWidgetRepository,
            caseWidgetTabRepository,
            caseTabRepository,
        )
    }

    private fun widget(
        key: String,
        configurationId: UUID?,
        bundleKey: String? = "summary-widget",
        pluginDefinitionKey: String? = "case-summary",
        pluginDefinitionVersion: String? = "0.1.0",
        tab: CaseWidgetTab? = null,
    ): ExternalPluginCaseWidget {
        val id = CaseWidgetTabWidgetId(key)
        tab?.let { id.caseWidgetTab = it }
        return ExternalPluginCaseWidget(
            id = id,
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
            bundleKey = bundleKey,
            pluginDefinitionKey = pluginDefinitionKey,
            pluginDefinitionVersion = pluginDefinitionVersion,
        )
    }

    private fun firstPartyWidget(key: String): CaseWidgetTabWidget = TestCaseWidgetTabWidget(
        id = CaseWidgetTabWidgetId(key),
        title = "Fields",
        order = 1,
        width = 2,
        highContrast = false,
        isCompact = null,
        actions = emptyList(),
        displayConditions = emptyList(),
        properties = TestCaseWidgetProperties("x"),
    )

    private fun widgetTab(tabKey: String, widgets: List<CaseWidgetTabWidget>): CaseWidgetTab =
        CaseWidgetTab(id = CaseTabId(caseDefinitionId, tabKey), widgets = widgets)

    private fun stubTabs(vararg tabs: CaseWidgetTab) {
        whenever(caseWidgetTabRepository.findAll(any<org.springframework.data.jpa.domain.Specification<CaseWidgetTab>>()))
            .thenReturn(tabs.toList())
    }

    // ---------------------------------------------------------------- listing

    @Test
    fun `lists every external-plugin widget with its configuration and plugin identity`() {
        val configurationId = UUID.randomUUID()
        stubTabs(widgetTab("summary", listOf(widget("summary-widget", configurationId))))

        val refs = service.findExternalPluginWidgets(caseDefinitionId)

        assertThat(refs).hasSize(1)
        assertThat(refs.single().caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(refs.single().tabKey).isEqualTo("summary")
        assertThat(refs.single().widgetKey).isEqualTo("summary-widget")
        assertThat(refs.single().configurationId).isEqualTo(configurationId)
        assertThat(refs.single().pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(refs.single().pluginDefinitionVersion).isEqualTo("0.1.0")
    }

    @Test
    fun `lists a dangling widget too — deciding what is dangling is the plugin module's job`() {
        stubTabs(widgetTab("summary", listOf(widget("orphan-widget", configurationId = null))))

        val refs = service.findExternalPluginWidgets(caseDefinitionId)

        assertThat(refs).hasSize(1)
        assertThat(refs.single().configurationId).isNull()
        // Still identifiable from the self-describing export, which is what the repair chooser needs.
        assertThat(refs.single().pluginDefinitionKey).isEqualTo("case-summary")
    }

    @Test
    fun `ignores first-party widgets in the same tab`() {
        val configurationId = UUID.randomUUID()
        stubTabs(
            widgetTab(
                "summary",
                listOf(firstPartyWidget("fields"), widget("summary-widget", configurationId)),
            )
        )

        assertThat(service.findExternalPluginWidgets(caseDefinitionId).map { it.widgetKey })
            .containsExactly("summary-widget")
    }

    @Test
    fun `spans several widget tabs of the case definition`() {
        stubTabs(
            widgetTab("summary", listOf(widget("a", UUID.randomUUID()))),
            widgetTab("metrics", listOf(widget("b", UUID.randomUUID()))),
        )

        assertThat(service.findExternalPluginWidgets(caseDefinitionId).map { it.tabKey to it.widgetKey })
            .containsExactly("summary" to "a", "metrics" to "b")
    }

    @Test
    fun `returns an empty list when the case definition has no widget tabs`() {
        stubTabs()

        assertThat(service.findExternalPluginWidgets(caseDefinitionId)).isEmpty()
    }

    // ---------------------------------------------------------------- remap

    @Test
    fun `remaps a widget's configuration id through the supplied mappings`() {
        val source = UUID.randomUUID()
        val target = UUID.randomUUID()
        stubTabs(widgetTab("summary", listOf(widget("summary-widget", source))))

        service.remapConfiguration(caseDefinitionId, mapOf(source to target))

        val captor = argumentCaptor<ExternalPluginCaseWidget>()
        verify(externalPluginCaseWidgetRepository).save(captor.capture())
        assertThat(captor.firstValue.externalPluginConfigurationId).isEqualTo(target)
        // Everything else survives the re-point.
        assertThat(captor.firstValue.bundleKey).isEqualTo("summary-widget")
        assertThat(captor.firstValue.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(captor.firstValue.pluginDefinitionVersion).isEqualTo("0.1.0")
    }

    @Test
    fun `leaves a widget alone when the mappings do not mention its configuration`() {
        stubTabs(widgetTab("summary", listOf(widget("summary-widget", UUID.randomUUID()))))

        service.remapConfiguration(caseDefinitionId, mapOf(UUID.randomUUID() to UUID.randomUUID()))

        verify(externalPluginCaseWidgetRepository, never()).save(any())
    }

    @Test
    fun `leaves a dangling widget alone — there is no source id to map from`() {
        stubTabs(widgetTab("summary", listOf(widget("orphan", configurationId = null))))

        service.remapConfiguration(caseDefinitionId, mapOf(UUID.randomUUID() to UUID.randomUUID()))

        verify(externalPluginCaseWidgetRepository, never()).save(any())
    }

    @Test
    fun `does nothing at all for an empty mapping set`() {
        service.remapConfiguration(caseDefinitionId, emptyMap())

        verify(caseWidgetTabRepository, never()).findAll(
            any<org.springframework.data.jpa.domain.Specification<CaseWidgetTab>>()
        )
        verify(externalPluginCaseWidgetRepository, never()).save(any())
    }

    @Test
    fun `remaps only the widgets named in the mappings, across tabs`() {
        val mapped = UUID.randomUUID()
        val target = UUID.randomUUID()
        stubTabs(
            widgetTab("summary", listOf(widget("a", mapped))),
            widgetTab("metrics", listOf(widget("b", UUID.randomUUID()))),
        )

        service.remapConfiguration(caseDefinitionId, mapOf(mapped to target))

        val captor = argumentCaptor<ExternalPluginCaseWidget>()
        verify(externalPluginCaseWidgetRepository).save(captor.capture())
        assertThat(captor.firstValue.id.key).isEqualTo("a")
    }

    // ---------------------------------------------------------------- delete guard usages

    @Test
    fun `reports a widget usage with the case, tab and widget identity the in-use modal renders`() {
        val configurationId = UUID.randomUUID()
        val tab = widgetTab("summary", emptyList())
        whenever(externalPluginCaseWidgetRepository.findAllByExternalPluginConfigurationId(configurationId))
            .thenReturn(listOf(widget("summary-widget", configurationId, tab = tab)))
        whenever(caseTabRepository.findById(tab.id)).thenReturn(
            Optional.of(CaseTab(tab.id, "Summary", 0, CaseTabType.WIDGETS, "widgets"))
        )

        val usages = service.findUsagesForConfiguration(configurationId)

        assertThat(usages).hasSize(1)
        assertThat(usages.single().configurationId).isEqualTo(configurationId)
        assertThat(usages.single().caseDefinitionKey).isEqualTo("my-case")
        assertThat(usages.single().caseDefinitionVersionTag).isEqualTo("1.0.0")
        assertThat(usages.single().tabKey).isEqualTo("summary")
        assertThat(usages.single().tabName).isEqualTo("Summary")
        assertThat(usages.single().widgetKey).isEqualTo("summary-widget")
    }

    @Test
    fun `still reports the usage when the owning tab row cannot be read`() {
        // A missing tab row must not hide the usage — that would let the configuration be deleted.
        val configurationId = UUID.randomUUID()
        val tab = widgetTab("summary", emptyList())
        whenever(externalPluginCaseWidgetRepository.findAllByExternalPluginConfigurationId(configurationId))
            .thenReturn(listOf(widget("summary-widget", configurationId, tab = tab)))
        whenever(caseTabRepository.findById(tab.id)).thenReturn(Optional.empty())

        val usages = service.findUsagesForConfiguration(configurationId)

        assertThat(usages).hasSize(1)
        assertThat(usages.single().tabName).isNull()
        assertThat(usages.single().widgetKey).isEqualTo("summary-widget")
    }

    @Test
    fun `skips a widget that is not attached to a tab`() {
        val configurationId = UUID.randomUUID()
        whenever(externalPluginCaseWidgetRepository.findAllByExternalPluginConfigurationId(configurationId))
            .thenReturn(listOf(widget("detached", configurationId, tab = null)))

        assertThat(service.findUsagesForConfiguration(configurationId)).isEmpty()
    }

    @Test
    fun `reports no usages for a configuration no widget references`() {
        val configurationId = UUID.randomUUID()
        whenever(externalPluginCaseWidgetRepository.findAllByExternalPluginConfigurationId(configurationId))
            .thenReturn(emptyList())

        assertThat(service.findUsagesForConfiguration(configurationId)).isEmpty()
    }
}
