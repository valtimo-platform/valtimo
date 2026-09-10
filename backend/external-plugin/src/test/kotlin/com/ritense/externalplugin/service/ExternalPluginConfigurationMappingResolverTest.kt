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

package com.ritense.externalplugin.service

import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabId
import com.ritense.case.domain.CaseTabType
import com.ritense.case.repository.CaseTabRepository
import com.ritense.case_.domain.tab.CaseExternalPluginTab
import com.ritense.case_.repository.CaseExternalPluginTabRepository
import com.ritense.case_.service.CaseExternalPluginWidgetRef
import com.ritense.case_.service.CaseExternalPluginWidgetService
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.externalplugin.repository.ExternalPluginTaskFormProcessLinkRepository
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.valtimo.contract.plugin.DanglingPluginConfigurationDto.Companion.SOURCE_EXTERNAL
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.lenient
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import org.springframework.data.jpa.domain.Specification
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class ExternalPluginConfigurationMappingResolverTest {

    @Mock
    lateinit var processLinkRepository: ExternalPluginProcessLinkRepository

    @Mock
    lateinit var taskFormProcessLinkRepository: ExternalPluginTaskFormProcessLinkRepository

    @Mock
    lateinit var configurationRepository: ExternalPluginConfigurationRepository

    @Mock
    lateinit var caseExternalPluginTabRepository: CaseExternalPluginTabRepository

    @Mock
    lateinit var caseTabRepository: CaseTabRepository

    @Mock
    lateinit var caseExternalPluginWidgetService: CaseExternalPluginWidgetService

    @Mock
    lateinit var processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService

    @Mock
    lateinit var caseDefinitionChecker: CaseDefinitionChecker

    @Mock
    lateinit var applicationEventPublisher: ApplicationEventPublisher

    private lateinit var resolver: ExternalPluginConfigurationMappingResolver

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

    @BeforeEach
    fun before() {
        resolver = ExternalPluginConfigurationMappingResolver(
            processLinkRepository,
            taskFormProcessLinkRepository,
            configurationRepository,
            caseExternalPluginTabRepository,
            caseTabRepository,
            caseExternalPluginWidgetService,
            processDefinitionCaseDefinitionService,
            caseDefinitionChecker,
            applicationEventPublisher,
        )
        lenient().whenever(taskFormProcessLinkRepository.findByProcessDefinitionId(any())).thenReturn(emptyList())
        lenient().whenever(caseTabRepository.findAll(any<Specification<CaseTab>>())).thenReturn(emptyList())
        lenient().whenever(caseExternalPluginWidgetService.findExternalPluginWidgets(any())).thenReturn(emptyList())
    }

    @Test
    fun `resolve asserts user can update case definition configuration`() {
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(emptyList())

        resolver.resolve(caseDefinitionId, emptyMap())

        verify(caseDefinitionChecker).assertCanUpdateCaseDefinitionConfiguration(
            caseDefinitionId,
            listOf(
                ExternalPluginConfigurationMappingResolver.PROCESS_LINK_ISSUE_TYPE,
                ExternalPluginConfigurationMappingResolver.TASK_FORM_ISSUE_TYPE,
                ExternalPluginConfigurationMappingResolver.CASE_TAB_ISSUE_TYPE,
                ExternalPluginConfigurationMappingResolver.CASE_WIDGET_ISSUE_TYPE,
            ),
        )
    }

    @Test
    fun `resolve replaces externalPluginConfigurationId based on source UUID mapping`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val link = processLink(externalPluginConfigurationId = sourceId)
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))
        whenever(configurationRepository.existsById(any())).thenReturn(true)

        resolver.resolve(caseDefinitionId, mapOf(sourceId to targetId))

        val captor = argumentCaptor<ExternalPluginProcessLink>()
        verify(processLinkRepository).save(captor.capture())
        assertThat(captor.firstValue.externalPluginConfigurationId).isEqualTo(targetId)
    }

    @Test
    fun `resolve replaces the configuration id on task-form links`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val link = taskFormLink(externalPluginConfigurationId = sourceId)
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(emptyList())
        whenever(taskFormProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))
        whenever(configurationRepository.existsById(any())).thenReturn(true)

        resolver.resolve(caseDefinitionId, mapOf(sourceId to targetId))

        val captor = argumentCaptor<ExternalPluginTaskFormProcessLink>()
        verify(taskFormProcessLinkRepository).save(captor.capture())
        assertThat(captor.firstValue.externalPluginConfigurationId).isEqualTo(targetId)
    }

    @Test
    fun `resolve remaps a dangling case tab contentKey and creates the side row`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val tab = CaseTab(
            id = CaseTabId(caseDefinitionId, "summary"),
            name = "Summary",
            tabOrder = 0,
            type = CaseTabType.EXTERNAL_PLUGIN,
            contentKey = "$sourceId:bundle-key",
        )
        stubProcessDefinitions()
        whenever(caseTabRepository.findAll(any<Specification<CaseTab>>())).thenReturn(listOf(tab))

        resolver.resolve(caseDefinitionId, mapOf(sourceId to targetId))

        val tabCaptor = argumentCaptor<CaseTab>()
        verify(caseTabRepository).save(tabCaptor.capture())
        assertThat(tabCaptor.firstValue.contentKey).isEqualTo("$targetId:bundle-key")

        // No prior side row is stubbed, so the preserved plugin identity is null here.
        verify(caseExternalPluginTabRepository).save(
            CaseExternalPluginTab(
                id = tab.id,
                externalPluginConfigurationId = targetId,
                bundleKey = "bundle-key",
            )
        )
    }

    @Test
    fun `resolve does not save links that are not in the mapping`() {
        val link = processLink(externalPluginConfigurationId = UUID.randomUUID())
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        resolver.resolve(caseDefinitionId, mapOf(UUID.randomUUID() to UUID.randomUUID()))

        verify(processLinkRepository, never()).save(any())
    }

    @Test
    fun `resolve emits resolved event when no dangling links remain`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val link = processLink(externalPluginConfigurationId = sourceId)
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))
        whenever(configurationRepository.existsById(any())).thenReturn(true)

        resolver.resolve(caseDefinitionId, mapOf(sourceId to targetId))

        // Each surface is judged independently now; the process-link surface is clean.
        verify(applicationEventPublisher).publishEvent(
            CaseConfigurationIssueResolvedEvent(caseDefinitionId, ExternalPluginConfigurationMappingResolver.PROCESS_LINK_ISSUE_TYPE)
        )
        verify(applicationEventPublisher, never()).publishEvent(any<CaseConfigurationIssueDetectedEvent>())
    }

    @Test
    fun `resolve emits detected event for the process-link surface when a dangling link remains`() {
        val danglingLink = processLink(externalPluginConfigurationId = UUID.randomUUID())
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(danglingLink))
        whenever(configurationRepository.existsById(any())).thenReturn(false)

        resolver.resolve(caseDefinitionId, emptyMap())

        // The dangling service-task link raises the process-link issue; the clean task-form and tab
        // surfaces are resolved independently (no cross-surface clobber).
        verify(applicationEventPublisher).publishEvent(
            CaseConfigurationIssueDetectedEvent(caseDefinitionId, ExternalPluginConfigurationMappingResolver.PROCESS_LINK_ISSUE_TYPE)
        )
        verify(applicationEventPublisher).publishEvent(
            CaseConfigurationIssueResolvedEvent(caseDefinitionId, ExternalPluginConfigurationMappingResolver.TASK_FORM_ISSUE_TYPE)
        )
    }

    @Test
    fun `getDanglingPluginConfigurations groups links by plugin definition key and version, tagged external`() {
        val danglingId1 = UUID.randomUUID()
        val danglingId2 = UUID.randomUUID()
        val existingId = UUID.randomUUID()

        val link1 = processLink(externalPluginConfigurationId = danglingId1, pluginDefinitionKey = "case-summary")
        val link2 = processLink(externalPluginConfigurationId = danglingId2, pluginDefinitionKey = "case-summary")
        val link3 = processLink(externalPluginConfigurationId = existingId, pluginDefinitionKey = "other-plugin")

        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link1, link2, link3))
        whenever(configurationRepository.existsById(any())).thenAnswer { invocation ->
            invocation.arguments[0] == existingId
        }

        val result = resolver.getDanglingPluginConfigurations(caseDefinitionId)

        assertThat(result).hasSize(1)
        val entry = result.single()
        assertThat(entry.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(entry.sourcePluginConfigurationIds).containsExactlyInAnyOrder(danglingId1, danglingId2)
        assertThat(entry.source).isEqualTo(SOURCE_EXTERNAL)
    }

    @Test
    fun `getDanglingPluginConfigurations skips BUILDING_BLOCK links`() {
        val link = processLink(
            externalPluginConfigurationId = null,
            referenceType = PluginConfigurationReferenceType.BUILDING_BLOCK,
        )
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        val result = resolver.getDanglingPluginConfigurations(caseDefinitionId)

        assertThat(result).isEmpty()
    }

    @Test
    fun `getDanglingPluginConfigurations includes dangling EXTERNAL_PLUGIN case tabs`() {
        val danglingConfigId = UUID.randomUUID()
        val tab = CaseTab(
            id = CaseTabId(caseDefinitionId, "summary"),
            name = "Summary",
            tabOrder = 0,
            type = CaseTabType.EXTERNAL_PLUGIN,
            contentKey = danglingConfigId.toString(),
        )
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(emptyList())
        whenever(caseTabRepository.findAll(any<Specification<CaseTab>>())).thenReturn(listOf(tab))
        whenever(caseExternalPluginTabRepository.findById(tab.id)).thenReturn(
            Optional.of(
                CaseExternalPluginTab(
                    id = tab.id,
                    externalPluginConfigurationId = danglingConfigId,
                    bundleKey = null,
                    pluginDefinitionKey = "case-summary",
                    pluginDefinitionVersion = "0.1.0",
                )
            )
        )
        whenever(configurationRepository.existsById(danglingConfigId)).thenReturn(false)

        val result = resolver.getDanglingPluginConfigurations(caseDefinitionId)

        assertThat(result).hasSize(1)
        assertThat(result.single().sourcePluginConfigurationIds).containsExactly(danglingConfigId)
        assertThat(result.single().source).isEqualTo(SOURCE_EXTERNAL)
        // The persisted plugin identity now makes the dangling tab identifiable (not key-less).
        assertThat(result.single().pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(result.single().pluginDefinitionVersion).isEqualTo("0.1.0")
    }

    @Test
    fun `resolve remaps external-plugin widgets through the widget service`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        stubProcessDefinitions()

        resolver.resolve(caseDefinitionId, mapOf(sourceId to targetId))

        verify(caseExternalPluginWidgetService).remapConfiguration(caseDefinitionId, mapOf(sourceId to targetId))
    }

    @Test
    fun `getDanglingPluginConfigurations includes dangling external-plugin widgets grouped by plugin identity`() {
        val danglingConfigId1 = UUID.randomUUID()
        val danglingConfigId2 = UUID.randomUUID()
        val existingConfigId = UUID.randomUUID()
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(emptyList())
        whenever(caseExternalPluginWidgetService.findExternalPluginWidgets(caseDefinitionId)).thenReturn(
            listOf(
                widgetRef(danglingConfigId1, "case-summary", "0.1.0"),
                widgetRef(danglingConfigId2, "case-summary", "0.1.0"),
                widgetRef(existingConfigId, "other-plugin", "1.0.0"),
            )
        )
        whenever(configurationRepository.existsById(any())).thenAnswer { it.arguments[0] == existingConfigId }

        val result = resolver.getDanglingPluginConfigurations(caseDefinitionId)

        assertThat(result).hasSize(1)
        val entry = result.single()
        assertThat(entry.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(entry.pluginDefinitionVersion).isEqualTo("0.1.0")
        assertThat(entry.sourcePluginConfigurationIds).containsExactlyInAnyOrder(danglingConfigId1, danglingConfigId2)
        assertThat(entry.source).isEqualTo(SOURCE_EXTERNAL)
    }

    @Test
    fun `recheckIssuesForCaseDefinition emits detected event for the case-widget surface when a widget is dangling`() {
        val danglingConfigId = UUID.randomUUID()
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(emptyList())
        whenever(caseExternalPluginWidgetService.findExternalPluginWidgets(caseDefinitionId)).thenReturn(
            listOf(widgetRef(danglingConfigId, "case-summary", "0.1.0"))
        )
        whenever(configurationRepository.existsById(danglingConfigId)).thenReturn(false)

        resolver.recheckIssuesForCaseDefinition(caseDefinitionId)

        verify(applicationEventPublisher).publishEvent(
            CaseConfigurationIssueDetectedEvent(caseDefinitionId, ExternalPluginConfigurationMappingResolver.CASE_WIDGET_ISSUE_TYPE)
        )
    }

    @Test
    fun `recheckIssuesForProcessDefinition emits resolved event when all links are valid`() {
        val pdId = ProcessDefinitionId.of("pd-1")
        val link = processDefinitionCaseDefinition("pd-1")
        whenever(processDefinitionCaseDefinitionService.findByProcessDefinitionIdOrNull(eq(pdId))).thenReturn(link)
        whenever(processDefinitionCaseDefinitionService.findProcessDefinitionCaseDefinitions(eq(caseDefinitionId)))
            .thenReturn(listOf(link))
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(emptyList())

        resolver.recheckIssuesForProcessDefinition("pd-1")

        verify(applicationEventPublisher).publishEvent(
            CaseConfigurationIssueResolvedEvent(caseDefinitionId, ExternalPluginConfigurationMappingResolver.PROCESS_LINK_ISSUE_TYPE)
        )
    }

    @Test
    fun `recheckIssuesForCaseDefinition emits detected event for the case-tab surface when a tab is dangling`() {
        val danglingConfigId = UUID.randomUUID()
        val tab = CaseTab(
            id = CaseTabId(caseDefinitionId, "summary"),
            name = "Summary",
            tabOrder = 0,
            type = CaseTabType.EXTERNAL_PLUGIN,
            contentKey = "$danglingConfigId:summary",
        )
        stubProcessDefinitions("pd-1")
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(emptyList())
        whenever(caseTabRepository.findAll(any<Specification<CaseTab>>())).thenReturn(listOf(tab))
        whenever(caseExternalPluginTabRepository.findById(tab.id)).thenReturn(
            Optional.of(
                CaseExternalPluginTab(
                    id = tab.id,
                    externalPluginConfigurationId = danglingConfigId,
                    bundleKey = "summary",
                    pluginDefinitionKey = "case-summary",
                    pluginDefinitionVersion = "0.1.0",
                )
            )
        )
        whenever(configurationRepository.existsById(danglingConfigId)).thenReturn(false)

        resolver.recheckIssuesForCaseDefinition(caseDefinitionId)

        verify(applicationEventPublisher).publishEvent(
            CaseConfigurationIssueDetectedEvent(caseDefinitionId, ExternalPluginConfigurationMappingResolver.CASE_TAB_ISSUE_TYPE)
        )
    }

    private fun stubProcessDefinitions(vararg processDefinitionIds: String) {
        val links = processDefinitionIds.map { processDefinitionCaseDefinition(it) }
        whenever(processDefinitionCaseDefinitionService.findProcessDefinitionCaseDefinitions(eq(caseDefinitionId)))
            .thenReturn(links)
    }

    private fun widgetRef(
        configurationId: UUID?,
        pluginDefinitionKey: String?,
        pluginDefinitionVersion: String?,
    ) = CaseExternalPluginWidgetRef(
        caseDefinitionId = caseDefinitionId,
        tabKey = "summary",
        widgetKey = "summary-widget",
        configurationId = configurationId,
        pluginDefinitionKey = pluginDefinitionKey,
        pluginDefinitionVersion = pluginDefinitionVersion,
    )

    private fun processDefinitionCaseDefinition(processDefinitionId: String) =
        ProcessDefinitionCaseDefinition(
            id = ProcessDefinitionCaseDefinitionId(
                processDefinitionId = ProcessDefinitionId.of(processDefinitionId),
                caseDefinitionId = caseDefinitionId,
            ),
        )

    private fun processLink(
        externalPluginConfigurationId: UUID?,
        referenceType: PluginConfigurationReferenceType = PluginConfigurationReferenceType.FIXED,
        pluginDefinitionKey: String? = "case-summary",
    ): ExternalPluginProcessLink = ExternalPluginProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = "pd-1",
        activityId = "Task_1",
        activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
        externalPluginConfigurationId = externalPluginConfigurationId,
        actionKey = "send",
        pluginConfigurationReference = PluginConfigurationReference(
            type = referenceType,
            pluginDefinitionKey = pluginDefinitionKey,
            pluginDefinitionVersion = if (referenceType == PluginConfigurationReferenceType.BUILDING_BLOCK) "1.0.0" else null,
        ),
    )

    private fun taskFormLink(
        externalPluginConfigurationId: UUID,
    ): ExternalPluginTaskFormProcessLink = ExternalPluginTaskFormProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = "pd-1",
        activityId = "Task_1",
        activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
        externalPluginConfigurationId = externalPluginConfigurationId,
        pluginConfigurationReference = PluginConfigurationReference(
            type = PluginConfigurationReferenceType.FIXED,
            pluginDefinitionKey = "case-summary",
        ),
    )
}
