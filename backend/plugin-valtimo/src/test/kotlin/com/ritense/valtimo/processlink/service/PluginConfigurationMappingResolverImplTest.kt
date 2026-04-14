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

package com.ritense.valtimo.processlink.service

import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.valtimo.processlink.mapper.PluginProcessLinkMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class PluginConfigurationMappingResolverImplTest {

    @Mock
    lateinit var pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository

    @Mock
    lateinit var pluginConfigurationRepository: PluginConfigurationRepository

    @Mock
    lateinit var processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService

    @Mock
    lateinit var caseDefinitionChecker: CaseDefinitionChecker

    @Mock
    lateinit var applicationEventPublisher: ApplicationEventPublisher

    private lateinit var resolver: PluginConfigurationMappingResolverImpl

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

    @BeforeEach
    fun before() {
        resolver = PluginConfigurationMappingResolverImpl(
            pluginProcessLinkRepository,
            pluginConfigurationRepository,
            processDefinitionCaseDefinitionService,
            caseDefinitionChecker,
            applicationEventPublisher,
        )
    }

    @Test
    fun `resolve asserts user can update case definition configuration`() {
        stubProcessDefinitions("pd-1")
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(emptyList())

        resolver.resolve(caseDefinitionId, emptyMap())

        verify(caseDefinitionChecker).assertCanUpdateCaseDefinitionConfiguration(
            caseDefinitionId,
            PluginProcessLinkMapper.ISSUE_TYPE,
        )
    }

    @Test
    fun `resolve replaces pluginConfigurationId based on source UUID mapping`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val link = pluginLink(
            pluginConfigurationId = PluginConfigurationId.existingId(sourceId),
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        stubProcessDefinitions("pd-1")
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))
        whenever(pluginConfigurationRepository.existsById(any())).thenReturn(true)

        resolver.resolve(caseDefinitionId, mapOf(sourceId to targetId))

        val captor = argumentCaptor<PluginProcessLink>()
        verify(pluginProcessLinkRepository).save(captor.capture())
        assertThat(captor.firstValue.pluginConfigurationId?.id).isEqualTo(targetId)
        assertThat(captor.firstValue.pluginConfigurationReference.pluginDefinitionKey).isEqualTo("zaken-api")
    }

    @Test
    fun `resolve matches by process link id when pluginConfigurationId is null`() {
        val linkId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val link = pluginLink(
            id = linkId,
            pluginConfigurationId = null,
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        stubProcessDefinitions("pd-1")
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))
        whenever(pluginConfigurationRepository.existsById(any())).thenReturn(true)

        resolver.resolve(caseDefinitionId, mapOf(linkId to targetId))

        val captor = argumentCaptor<PluginProcessLink>()
        verify(pluginProcessLinkRepository).save(captor.capture())
        assertThat(captor.firstValue.pluginConfigurationId?.id).isEqualTo(targetId)
    }

    @Test
    fun `resolve does not save links that are not in the mapping`() {
        val link = pluginLink(
            pluginConfigurationId = PluginConfigurationId.existingId(UUID.randomUUID()),
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        stubProcessDefinitions("pd-1")
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        resolver.resolve(caseDefinitionId, mapOf(UUID.randomUUID() to UUID.randomUUID()))

        verify(pluginProcessLinkRepository, never()).save(any())
    }

    @Test
    fun `resolve skips BUILDING_BLOCK links`() {
        val sourceId = UUID.randomUUID()
        val link = pluginLink(
            pluginConfigurationId = null,
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.BUILDING_BLOCK, "zaken-api"),
        )
        stubProcessDefinitions("pd-1")
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        resolver.resolve(caseDefinitionId, mapOf(sourceId to UUID.randomUUID()))

        verify(pluginProcessLinkRepository, never()).save(any())
    }

    @Test
    fun `resolve emits resolved event when no dangling links remain`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val link = pluginLink(
            pluginConfigurationId = PluginConfigurationId.existingId(sourceId),
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        stubProcessDefinitions("pd-1")
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))
        whenever(pluginConfigurationRepository.existsById(eq(PluginConfigurationId.existingId(targetId))))
            .thenReturn(true)

        resolver.resolve(caseDefinitionId, mapOf(sourceId to targetId))

        verify(applicationEventPublisher).publishEvent(any<CaseConfigurationIssueResolvedEvent>())
    }

    @Test
    fun `resolve emits detected event when dangling links remain`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val danglingLink = pluginLink(
            pluginConfigurationId = PluginConfigurationId.existingId(UUID.randomUUID()),
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        val mappedLink = pluginLink(
            pluginConfigurationId = PluginConfigurationId.existingId(sourceId),
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        stubProcessDefinitions("pd-1")
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1"))
            .thenReturn(listOf(danglingLink, mappedLink))
        whenever(pluginConfigurationRepository.existsById(any())).thenAnswer { invocation ->
            val id = invocation.arguments[0] as PluginConfigurationId
            id.id == targetId
        }

        resolver.resolve(caseDefinitionId, mapOf(sourceId to targetId))

        verify(applicationEventPublisher).publishEvent(any<CaseConfigurationIssueDetectedEvent>())
    }

    @Test
    fun `getDanglingPluginConfigurations returns links grouped by plugin definition key`() {
        val danglingId1 = UUID.randomUUID()
        val danglingId2 = UUID.randomUUID()
        val existingId = UUID.randomUUID()

        val link1 = pluginLink(
            pluginConfigurationId = PluginConfigurationId.existingId(danglingId1),
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        val link2 = pluginLink(
            pluginConfigurationId = PluginConfigurationId.existingId(danglingId2),
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        val link3 = pluginLink(
            pluginConfigurationId = PluginConfigurationId.existingId(existingId),
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "other-api"),
        )

        stubProcessDefinitions("pd-1")
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1"))
            .thenReturn(listOf(link1, link2, link3))
        whenever(pluginConfigurationRepository.existsById(any())).thenAnswer { invocation ->
            val id = invocation.arguments[0] as PluginConfigurationId
            id.id == existingId
        }

        val result = resolver.getDanglingPluginConfigurations(caseDefinitionId)

        assertThat(result).hasSize(1)
        val zakenApi = result.single()
        assertThat(zakenApi.pluginDefinitionKey).isEqualTo("zaken-api")
        assertThat(zakenApi.sourcePluginConfigurationIds).containsExactlyInAnyOrder(danglingId1, danglingId2)
    }

    @Test
    fun `getDanglingPluginConfigurations uses process link id when pluginConfigurationId is null`() {
        val linkId = UUID.randomUUID()
        val link = pluginLink(
            id = linkId,
            pluginConfigurationId = null,
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        stubProcessDefinitions("pd-1")
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        val result = resolver.getDanglingPluginConfigurations(caseDefinitionId)

        assertThat(result).hasSize(1)
        assertThat(result[0].sourcePluginConfigurationIds).containsExactly(linkId)
    }

    @Test
    fun `getDanglingPluginConfigurations skips BUILDING_BLOCK links`() {
        val link = pluginLink(
            pluginConfigurationId = null,
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.BUILDING_BLOCK, "zaken-api"),
        )
        stubProcessDefinitions("pd-1")
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        val result = resolver.getDanglingPluginConfigurations(caseDefinitionId)

        assertThat(result).isEmpty()
    }

    @Test
    fun `recheckIssuesForProcessDefinition emits resolved event when all links are valid`() {
        val pdId = ProcessDefinitionId.of("pd-1")
        val link = processDefinitionCaseDefinition("pd-1")
        whenever(processDefinitionCaseDefinitionService.findByProcessDefinitionId(eq(pdId))).thenReturn(link)
        whenever(processDefinitionCaseDefinitionService.findProcessDefinitionCaseDefinitions(eq(caseDefinitionId)))
            .thenReturn(listOf(link))
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(emptyList())

        resolver.recheckIssuesForProcessDefinition("pd-1")

        verify(applicationEventPublisher).publishEvent(any<CaseConfigurationIssueResolvedEvent>())
    }

    private fun stubProcessDefinitions(vararg processDefinitionIds: String) {
        val links = processDefinitionIds.map { processDefinitionCaseDefinition(it) }
        whenever(processDefinitionCaseDefinitionService.findProcessDefinitionCaseDefinitions(eq(caseDefinitionId)))
            .thenReturn(links)
    }

    private fun processDefinitionCaseDefinition(processDefinitionId: String) =
        ProcessDefinitionCaseDefinition(
            id = ProcessDefinitionCaseDefinitionId(
                processDefinitionId = ProcessDefinitionId.of(processDefinitionId),
                caseDefinitionId = caseDefinitionId,
            ),
        )

    private fun pluginLink(
        id: UUID = UUID.randomUUID(),
        pluginConfigurationId: PluginConfigurationId?,
        reference: PluginConfigurationReference,
    ): PluginProcessLink = PluginProcessLink(
        id = id,
        processDefinitionId = "pd-1",
        activityId = "Task_1",
        activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
        actionProperties = null,
        pluginConfigurationId = pluginConfigurationId,
        pluginConfigurationReference = reference,
        pluginActionDefinitionKey = "create-zaak",
    )
}
