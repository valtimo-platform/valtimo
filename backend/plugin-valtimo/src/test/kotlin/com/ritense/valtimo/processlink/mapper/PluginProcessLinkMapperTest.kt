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

package com.ritense.valtimo.processlink.mapper

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginDefinition
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.web.rest.request.PluginProcessLinkCreateDto
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class PluginProcessLinkMapperTest {

    @Mock
    lateinit var pluginConfigurationRepository: PluginConfigurationRepository

    @Mock
    lateinit var pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository

    @Mock
    lateinit var applicationEventPublisher: ApplicationEventPublisher

    private lateinit var mapper: PluginProcessLinkMapper

    private val caseDefinitionId = CaseDefinitionId("my-case", "1.0.0")

    @BeforeEach
    fun before() {
        mapper = PluginProcessLinkMapper(
            jacksonObjectMapper(),
            pluginConfigurationRepository,
            pluginProcessLinkRepository,
        )
    }

    @Test
    fun `afterImport emits detected event when FIXED link has missing pluginConfigurationId`() {
        val configId = PluginConfigurationId.existingId(UUID.randomUUID())
        val link = pluginLink(
            pluginConfigurationId = configId,
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))
        whenever(pluginConfigurationRepository.existsById(configId)).thenReturn(false)

        mapper.afterImport(caseDefinitionId, setOf("pd-1"), applicationEventPublisher)

        val captor = argumentCaptor<CaseConfigurationIssueDetectedEvent>()
        verify(applicationEventPublisher).publishEvent(captor.capture())
        assertThat(captor.firstValue.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(captor.firstValue.issueType).isEqualTo(PluginProcessLinkMapper.ISSUE_TYPE)
    }

    @Test
    fun `afterImport emits detected event when FIXED link has null pluginConfigurationId`() {
        val link = pluginLink(
            pluginConfigurationId = null,
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        mapper.afterImport(caseDefinitionId, setOf("pd-1"), applicationEventPublisher)

        verify(applicationEventPublisher).publishEvent(any<CaseConfigurationIssueDetectedEvent>())
        verify(applicationEventPublisher, never()).publishEvent(any<CaseConfigurationIssueResolvedEvent>())
    }

    @Test
    fun `afterImport emits resolved event when all FIXED links have existing configurations`() {
        val configId = PluginConfigurationId.existingId(UUID.randomUUID())
        val link = pluginLink(
            pluginConfigurationId = configId,
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))
        whenever(pluginConfigurationRepository.existsById(configId)).thenReturn(true)

        mapper.afterImport(caseDefinitionId, setOf("pd-1"), applicationEventPublisher)

        val captor = argumentCaptor<CaseConfigurationIssueResolvedEvent>()
        verify(applicationEventPublisher).publishEvent(captor.capture())
        assertThat(captor.firstValue.issueType).isEqualTo(PluginProcessLinkMapper.ISSUE_TYPE)
    }

    @Test
    fun `afterImport ignores BUILDING_BLOCK links`() {
        val link = pluginLink(
            pluginConfigurationId = null,
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.BUILDING_BLOCK, "zaken-api"),
        )
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        mapper.afterImport(caseDefinitionId, setOf("pd-1"), applicationEventPublisher)

        verify(applicationEventPublisher).publishEvent(any<CaseConfigurationIssueResolvedEvent>())
    }

    @Test
    fun `afterImport queries all given process definition ids`() {
        whenever(pluginProcessLinkRepository.findByProcessDefinitionId(any())).thenReturn(emptyList())

        mapper.afterImport(caseDefinitionId, setOf("pd-1", "pd-2"), applicationEventPublisher)

        verify(pluginProcessLinkRepository).findByProcessDefinitionId("pd-1")
        verify(pluginProcessLinkRepository).findByProcessDefinitionId("pd-2")
    }

    @Test
    fun `toNewProcessLink stores pluginDefinitionKey on FIXED reference`() {
        val configId = UUID.randomUUID()
        val createDto = PluginProcessLinkCreateDto(
            processDefinitionId = "pd-1",
            activityId = "Task_1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            pluginConfigurationId = configId,
            pluginActionDefinitionKey = "create-zaak",
            actionProperties = null,
            referenceType = PluginConfigurationReferenceType.FIXED,
            pluginDefinitionKey = "zaken-api",
        )

        val link = mapper.toNewProcessLink(createDto, null)

        assertThat(link.pluginConfigurationReference.type).isEqualTo(PluginConfigurationReferenceType.FIXED)
        assertThat(link.pluginConfigurationReference.pluginDefinitionKey).isEqualTo("zaken-api")
        assertThat(link.pluginConfigurationId?.id).isEqualTo(configId)
    }

    @Test
    fun `toNewProcessLink allows null pluginDefinitionKey on FIXED reference`() {
        val createDto = PluginProcessLinkCreateDto(
            processDefinitionId = "pd-1",
            activityId = "Task_1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            pluginConfigurationId = UUID.randomUUID(),
            pluginActionDefinitionKey = "create-zaak",
            actionProperties = null,
            referenceType = PluginConfigurationReferenceType.FIXED,
            pluginDefinitionKey = null,
        )

        val link = mapper.toNewProcessLink(createDto, null)

        assertThat(link.pluginConfigurationReference.pluginDefinitionKey).isNull()
    }

    @Test
    fun `toProcessLinkExportResponseDto uses pluginDefinitionKey from reference when set`() {
        val link = pluginLink(
            pluginConfigurationId = PluginConfigurationId.existingId(UUID.randomUUID()),
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, "zaken-api"),
        )

        val dto = mapper.toProcessLinkExportResponseDto(link)

        assertThat(dto.pluginDefinitionKey).isEqualTo("zaken-api")
    }

    @Test
    fun `toProcessLinkExportResponseDto falls back to repository lookup when reference key is null`() {
        val configId = PluginConfigurationId.existingId(UUID.randomUUID())
        val pluginDefinition = mock<PluginDefinition>()
        whenever(pluginDefinition.key).thenReturn("resolved-key")
        val pluginConfiguration = mock<PluginConfiguration>()
        whenever(pluginConfiguration.pluginDefinition).thenReturn(pluginDefinition)
        whenever(pluginConfigurationRepository.findById(eq(configId)))
            .thenReturn(Optional.of(pluginConfiguration))

        val link = pluginLink(
            pluginConfigurationId = configId,
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, null),
        )

        val dto = mapper.toProcessLinkExportResponseDto(link)

        assertThat(dto.pluginDefinitionKey).isEqualTo("resolved-key")
    }

    @Test
    fun `toProcessLinkExportResponseDto returns null key when both reference and lookup are empty`() {
        val configId = PluginConfigurationId.existingId(UUID.randomUUID())
        whenever(pluginConfigurationRepository.findById(eq(configId))).thenReturn(Optional.empty())

        val link = pluginLink(
            pluginConfigurationId = configId,
            reference = PluginConfigurationReference(PluginConfigurationReferenceType.FIXED, null),
        )

        val dto = mapper.toProcessLinkExportResponseDto(link)

        assertThat(dto.pluginDefinitionKey).isNull()
    }

    private fun pluginLink(
        pluginConfigurationId: PluginConfigurationId?,
        reference: PluginConfigurationReference,
    ): PluginProcessLink = PluginProcessLink(
        id = UUID.randomUUID(),
        processDefinitionId = "pd-1",
        activityId = "Task_1",
        activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
        actionProperties = null,
        pluginConfigurationId = pluginConfigurationId,
        pluginConfigurationReference = reference,
        pluginActionDefinitionKey = "create-zaak",
    )
}