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

package com.ritense.externalplugin.processlink

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginTaskFormProcessLink
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkCreateRequestDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkDeployDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkExportResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginTaskFormProcessLinkUpdateRequestDto
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginTaskFormProcessLinkRepository
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import java.time.Instant
import java.util.Optional
import java.util.UUID

class ExternalPluginTaskFormProcessLinkMapperTest {

    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var processLinkRepository: ExternalPluginTaskFormProcessLinkRepository
    private lateinit var mapper: ExternalPluginTaskFormProcessLinkMapper

    private val definitionId = UUID.randomUUID()
    private val configId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        definitionRepository = mock()
        processLinkRepository = mock()
        mapper = ExternalPluginTaskFormProcessLinkMapper(ObjectMapper(), configurationRepository, definitionRepository, processLinkRepository)

        val configuration = ExternalPluginConfiguration(
            id = configId,
            definitionId = definitionId,
            title = "Case summary configuration",
            createdAt = Instant.now(),
        )
        val definition = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "case-summary",
            version = "1.2.3",
            hostId = UUID.randomUUID(),
            baseUrl = "http://localhost:8090",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
        )
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.of(configuration))
        whenever(definitionRepository.findById(definitionId)).thenReturn(Optional.of(definition))
    }

    @Test
    fun `supports only the task-form link type`() {
        assertThat(mapper.supportsProcessLinkType("external_plugin_task_form")).isTrue()
        assertThat(mapper.supportsProcessLinkType("external_plugin")).isFalse()
        assertThat(mapper.supportsProcessLinkType("form")).isFalse()
    }

    @Test
    fun `maps a create request to a new process link, deriving the reference from the configuration`() {
        val createDto = ExternalPluginTaskFormProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = configId,
            // deliberately stale — must be overridden by the derived configuration
            pluginVersion = "9.9.9",
            bundleKey = "review",
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginTaskFormProcessLink

        assertThat(processLink.processDefinitionId).isEqualTo("pd-1")
        assertThat(processLink.activityId).isEqualTo("activity-1")
        assertThat(processLink.activityType).isEqualTo(ActivityTypeWithEventName.USER_TASK_CREATE)
        assertThat(processLink.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(processLink.pluginConfigurationReference.type).isEqualTo(PluginConfigurationReferenceType.FIXED)
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionVersion).isEqualTo("1.2.3")
        assertThat(processLink.bundleKey).isEqualTo("review")
        assertThat(processLink.processLinkType).isEqualTo("external_plugin_task_form")
    }

    @Test
    fun `create falls back to the dto-supplied pluginVersion when the configuration cannot be resolved (dangling import)`() {
        val danglingConfigId = UUID.randomUUID()
        whenever(configurationRepository.findById(danglingConfigId)).thenReturn(Optional.empty())

        val createDto = ExternalPluginTaskFormProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = danglingConfigId,
            pluginVersion = "1.0.0",
            bundleKey = "review",
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginTaskFormProcessLink

        assertThat(processLink.pluginConfigurationReference.pluginDefinitionKey).isNull()
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionVersion).isEqualTo("1.0.0")
    }

    @Test
    fun `maps a process link to a response dto`() {
        val id = UUID.randomUUID()
        val processLink = ExternalPluginTaskFormProcessLink(
            id = id,
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = configId,
            bundleKey = "review",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
                pluginDefinitionVersion = "0.1.0",
            ),
        )

        val dto = mapper.toProcessLinkResponseDto(processLink) as ExternalPluginTaskFormProcessLinkResponseDto

        assertThat(dto.id).isEqualTo(id)
        assertThat(dto.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(dto.bundleKey).isEqualTo("review")
        assertThat(dto.pluginVersion).isEqualTo("0.1.0")
        assertThat(dto.processLinkType).isEqualTo("external_plugin_task_form")
    }

    @Test
    fun `maps an update request onto the existing process link, deriving the reference from the new configuration`() {
        val id = UUID.randomUUID()
        val existing = ExternalPluginTaskFormProcessLink(
            id = id,
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = UUID.randomUUID(),
            bundleKey = "review",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "old-plugin",
                pluginDefinitionVersion = "0.0.1",
            ),
        )
        val updateDto = ExternalPluginTaskFormProcessLinkUpdateRequestDto(
            id = id,
            externalPluginConfigurationId = configId,
            pluginVersion = "0.2.0",
            bundleKey = "approve",
        )

        val updated = mapper.toUpdatedProcessLink(existing, updateDto, null) as ExternalPluginTaskFormProcessLink

        assertThat(updated.id).isEqualTo(id)
        assertThat(updated.processDefinitionId).isEqualTo("pd-1")
        assertThat(updated.activityId).isEqualTo("activity-1")
        assertThat(updated.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(updated.pluginConfigurationReference.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(updated.pluginConfigurationReference.pluginDefinitionVersion).isEqualTo("1.2.3")
        assertThat(updated.bundleKey).isEqualTo("approve")
    }

    @Test
    fun `maps a deploy dto to a create request`() {
        val deployDto = ExternalPluginTaskFormProcessLinkDeployDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = configId,
            pluginVersion = "0.1.0",
            bundleKey = "review",
        )

        val createDto = mapper.toProcessLinkCreateRequestDto(deployDto, null)
            as ExternalPluginTaskFormProcessLinkCreateRequestDto

        assertThat(createDto.processDefinitionId).isEqualTo("pd-1")
        assertThat(createDto.activityId).isEqualTo("activity-1")
        assertThat(createDto.activityType).isEqualTo(ActivityTypeWithEventName.USER_TASK_CREATE)
        assertThat(createDto.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(createDto.pluginVersion).isEqualTo("0.1.0")
        assertThat(createDto.bundleKey).isEqualTo("review")
        assertThat(createDto.processLinkType).isEqualTo("external_plugin_task_form")
    }

    @Test
    fun `maps a deploy dto to an update request onto the existing link id`() {
        val existingId = UUID.randomUUID()
        val deployDto = ExternalPluginTaskFormProcessLinkDeployDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = configId,
            pluginVersion = "0.1.0",
            bundleKey = "review",
        )

        val updateDto = mapper.toProcessLinkUpdateRequestDto(deployDto, existingId, null)
            as ExternalPluginTaskFormProcessLinkUpdateRequestDto

        assertThat(updateDto.id).isEqualTo(existingId)
        assertThat(updateDto.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(updateDto.pluginVersion).isEqualTo("0.1.0")
        assertThat(updateDto.bundleKey).isEqualTo("review")
        assertThat(updateDto.processLinkType).isEqualTo("external_plugin_task_form")
    }

    @Test
    fun `maps a process link to an export response dto without the process definition id`() {
        val processLink = ExternalPluginTaskFormProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = configId,
            bundleKey = "review",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
                pluginDefinitionVersion = "0.1.0",
            ),
        )

        val dto = mapper.toProcessLinkExportResponseDto(processLink)
            as ExternalPluginTaskFormProcessLinkExportResponseDto

        assertThat(dto.activityId).isEqualTo("activity-1")
        assertThat(dto.activityType).isEqualTo(ActivityTypeWithEventName.USER_TASK_CREATE)
        assertThat(dto.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(dto.bundleKey).isEqualTo("review")
        assertThat(dto.pluginVersion).isEqualTo("0.1.0")
        assertThat(dto.processLinkType).isEqualTo("external_plugin_task_form")
    }

    @Test
    fun `maps an unkeyed bundle create request with a null bundle key`() {
        val createDto = ExternalPluginTaskFormProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = configId,
            pluginVersion = "0.1.0",
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginTaskFormProcessLink

        assertThat(processLink.bundleKey).isNull()
    }

    @Test
    fun `applyPluginConfigurationMappings rewrites externalPluginConfigurationId to the mapped target id`() {
        val sourceId = UUID.randomUUID()
        val targetId = UUID.randomUUID()
        val node = ObjectMapper().createObjectNode().put("externalPluginConfigurationId", sourceId.toString())

        mapper.applyPluginConfigurationMappings(node, mapOf(sourceId to targetId))

        assertThat(node.get("externalPluginConfigurationId").asText()).isEqualTo(targetId.toString())
    }

    @Test
    fun `applyPluginConfigurationMappings leaves externalPluginConfigurationId unchanged when mapping value is null`() {
        val sourceId = UUID.randomUUID()
        val node = ObjectMapper().createObjectNode().put("externalPluginConfigurationId", sourceId.toString())

        mapper.applyPluginConfigurationMappings(node, mapOf(sourceId to null))

        assertThat(node.get("externalPluginConfigurationId").asText()).isEqualTo(sourceId.toString())
    }

    @Test
    fun `afterImport emits detected event when the referenced configuration no longer exists`() {
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val danglingConfigId = UUID.randomUUID()
        whenever(configurationRepository.existsById(danglingConfigId)).thenReturn(false)
        val link = ExternalPluginTaskFormProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = danglingConfigId,
            bundleKey = "review",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
            ),
        )
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        mapper.afterImport(CaseDefinitionId("my-case", "1.0.0"), setOf("pd-1"), applicationEventPublisher)

        verify(applicationEventPublisher).publishEvent(any<CaseConfigurationIssueDetectedEvent>())
        verify(applicationEventPublisher, never()).publishEvent(any<CaseConfigurationIssueResolvedEvent>())
    }

    @Test
    fun `afterImport emits resolved event when all referenced configurations exist`() {
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        whenever(configurationRepository.existsById(configId)).thenReturn(true)
        val link = ExternalPluginTaskFormProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.USER_TASK_CREATE,
            externalPluginConfigurationId = configId,
            bundleKey = "review",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
            ),
        )
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        mapper.afterImport(CaseDefinitionId("my-case", "1.0.0"), setOf("pd-1"), applicationEventPublisher)

        verify(applicationEventPublisher).publishEvent(any<CaseConfigurationIssueResolvedEvent>())
        verify(applicationEventPublisher, never()).publishEvent(any<CaseConfigurationIssueDetectedEvent>())
    }
}
