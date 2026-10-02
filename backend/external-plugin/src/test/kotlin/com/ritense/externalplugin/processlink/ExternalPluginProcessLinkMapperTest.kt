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
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkCreateRequestDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkDeployDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkExportResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkResponseDto
import com.ritense.externalplugin.processlink.web.dto.ExternalPluginProcessLinkUpdateRequestDto
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.plugin.domain.PluginActionResultMapping
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.valueresolver.exception.ValueResolverValidationException
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
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

class ExternalPluginProcessLinkMapperTest {

    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var processLinkRepository: ExternalPluginProcessLinkRepository
    private lateinit var mapper: ExternalPluginProcessLinkMapper

    private val definitionId = UUID.randomUUID()
    private val configId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        definitionRepository = mock()
        processLinkRepository = mock()
        mapper = ExternalPluginProcessLinkMapper(
            ObjectMapper(),
            configurationRepository,
            definitionRepository,
            processLinkRepository,
        )

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
    fun `create accepts action result mappings whose sources match declared action outputs`() {
        val definitionWithOutputs = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "case-summary",
            version = "1.2.3",
            hostId = UUID.randomUUID(),
            baseUrl = "http://localhost:8090",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
            manifestJson = manifestWithActionOutputs("send", listOf("summary", "title")),
        )
        whenever(definitionRepository.findById(definitionId)).thenReturn(Optional.of(definitionWithOutputs))

        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configId,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.FIXED,
            actionResultMappings = listOf(PluginActionResultMapping(source = "/summary", target = "doc:/summary")),
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginProcessLink

        assertThat(processLink.actionResultMappings).hasSize(1)
    }

    @Test
    fun `create rejects an action result mapping source that is not a declared action output`() {
        val definitionWithOutputs = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "case-summary",
            version = "1.2.3",
            hostId = UUID.randomUUID(),
            baseUrl = "http://localhost:8090",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
            manifestJson = manifestWithActionOutputs("send", listOf("summary", "title")),
        )
        whenever(definitionRepository.findById(definitionId)).thenReturn(Optional.of(definitionWithOutputs))

        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configId,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.FIXED,
            actionResultMappings = listOf(PluginActionResultMapping(source = "/unknownKey", target = "doc:/summary")),
        )

        assertThatThrownBy { mapper.toNewProcessLink(createDto, null) }
            .isInstanceOf(ValueResolverValidationException::class.java)
            .hasMessageContaining("does not match a declared output")
    }

    @Test
    fun `create rejects any action result mapping when the action declares no outputs`() {
        val definitionWithoutOutputs = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "case-summary",
            version = "1.2.3",
            hostId = UUID.randomUUID(),
            baseUrl = "http://localhost:8090",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
            manifestJson = manifestWithActionOutputs("send", emptyList()),
        )
        whenever(definitionRepository.findById(definitionId)).thenReturn(Optional.of(definitionWithoutOutputs))

        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configId,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.FIXED,
            actionResultMappings = listOf(PluginActionResultMapping(source = "/summary", target = "doc:/summary")),
        )

        assertThatThrownBy { mapper.toNewProcessLink(createDto, null) }
            .isInstanceOf(ValueResolverValidationException::class.java)
            .hasMessageContaining("does not declare any outputs")
    }

    @Test
    fun `create is lenient and skips source validation when the definition cannot be resolved`() {
        val danglingConfigId = UUID.randomUUID()
        whenever(configurationRepository.findById(danglingConfigId)).thenReturn(Optional.empty())

        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = danglingConfigId,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.FIXED,
            pluginDefinitionKey = "case-summary",
            pluginVersion = "1.0.0",
            actionResultMappings = listOf(PluginActionResultMapping(source = "/anything", target = "doc:/summary")),
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginProcessLink

        assertThat(processLink.actionResultMappings).hasSize(1)
    }

    @Test
    fun `create is lenient and skips source validation when the resolved definition has no manifest`() {
        val definitionWithoutManifest = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "case-summary",
            version = "1.2.3",
            hostId = UUID.randomUUID(),
            baseUrl = "http://localhost:8090",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
            manifestJson = null,
        )
        whenever(definitionRepository.findById(definitionId)).thenReturn(Optional.of(definitionWithoutManifest))

        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configId,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.FIXED,
            actionResultMappings = listOf(PluginActionResultMapping(source = "/anything", target = "doc:/summary")),
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginProcessLink

        assertThat(processLink.actionResultMappings).hasSize(1)
    }

    private fun manifestWithActionOutputs(actionKey: String, outputs: List<String>): com.fasterxml.jackson.databind.node.ObjectNode {
        val objectMapper = ObjectMapper()
        val manifest = objectMapper.createObjectNode()
        val actions = manifest.putArray("actions")
        val action = actions.addObject()
        action.put("key", actionKey)
        val outputsArray = action.putArray("outputs")
        outputs.forEach { outputsArray.add(it) }
        return manifest
    }

    @Test
    fun `supports only the external_plugin link type`() {
        assertThat(mapper.supportsProcessLinkType("external_plugin")).isTrue()
        assertThat(mapper.supportsProcessLinkType("external_plugin_task_form")).isFalse()
        assertThat(mapper.supportsProcessLinkType("plugin")).isFalse()
    }

    @Test
    fun `FIXED create derives pluginDefinitionKey and pluginVersion from the configuration, ignoring any values on the dto`() {
        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configId,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.FIXED,
            // deliberately wrong/stale values — must be overridden by the derived configuration
            pluginDefinitionKey = "some-other-plugin",
            pluginVersion = "9.9.9",
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginProcessLink

        assertThat(processLink.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(processLink.actionKey).isEqualTo("send")
        assertThat(processLink.pluginConfigurationReference.type).isEqualTo(PluginConfigurationReferenceType.FIXED)
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionVersion).isEqualTo("1.2.3")
    }

    @Test
    fun `FIXED create falls back to dto-supplied key and version when the configuration cannot be resolved (dangling import)`() {
        val danglingConfigId = UUID.randomUUID()
        whenever(configurationRepository.findById(danglingConfigId)).thenReturn(Optional.empty())

        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = danglingConfigId,
            actionKey = "send",
            pluginDefinitionKey = "case-summary",
            pluginVersion = "1.0.0",
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginProcessLink

        assertThat(processLink.pluginConfigurationReference.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionVersion).isEqualTo("1.0.0")
    }

    @Test
    fun `FIXED create allows a null configuration id (dangling import placeholder)`() {
        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = null,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.FIXED,
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginProcessLink

        assertThat(processLink.externalPluginConfigurationId).isNull()
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionKey).isNull()
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionVersion).isNull()
    }

    @Test
    fun `BUILDING_BLOCK create requires pluginDefinitionKey and pluginVersion from the dto and rejects a configuration id`() {
        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = null,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.BUILDING_BLOCK,
            pluginDefinitionKey = "case-summary",
            pluginVersion = "2.0.0",
        )

        val processLink = mapper.toNewProcessLink(createDto, null) as ExternalPluginProcessLink

        assertThat(processLink.externalPluginConfigurationId).isNull()
        assertThat(processLink.pluginConfigurationReference.type).isEqualTo(PluginConfigurationReferenceType.BUILDING_BLOCK)
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionVersion).isEqualTo("2.0.0")
    }

    @Test
    fun `BUILDING_BLOCK create rejects a non-null configuration id`() {
        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configId,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.BUILDING_BLOCK,
            pluginDefinitionKey = "case-summary",
            pluginVersion = "2.0.0",
        )

        assertThatThrownBy { mapper.toNewProcessLink(createDto, null) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("externalPluginConfigurationId must be empty")
    }

    @Test
    fun `BUILDING_BLOCK create requires pluginDefinitionKey`() {
        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.BUILDING_BLOCK,
            pluginVersion = "2.0.0",
        )

        assertThatThrownBy { mapper.toNewProcessLink(createDto, null) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("pluginDefinitionKey is required")
    }

    @Test
    fun `BUILDING_BLOCK create requires pluginVersion`() {
        val createDto = ExternalPluginProcessLinkCreateRequestDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            actionKey = "send",
            referenceType = PluginConfigurationReferenceType.BUILDING_BLOCK,
            pluginDefinitionKey = "case-summary",
        )

        assertThatThrownBy { mapper.toNewProcessLink(createDto, null) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("pluginVersion is required")
    }

    @Test
    fun `FIXED update derives pluginDefinitionKey and pluginVersion from the configuration`() {
        val id = UUID.randomUUID()
        val existing = ExternalPluginProcessLink(
            id = id,
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = UUID.randomUUID(),
            actionKey = "send",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "old-plugin",
                pluginDefinitionVersion = "0.0.1",
            ),
        )
        val updateDto = ExternalPluginProcessLinkUpdateRequestDto(
            id = id,
            externalPluginConfigurationId = configId,
            actionKey = "send",
        )

        val updated = mapper.toUpdatedProcessLink(existing, updateDto, null) as ExternalPluginProcessLink

        assertThat(updated.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(updated.pluginConfigurationReference.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(updated.pluginConfigurationReference.pluginDefinitionVersion).isEqualTo("1.2.3")
    }

    @Test
    fun `maps a process link to a response dto exposing the reference fields`() {
        val id = UUID.randomUUID()
        val processLink = ExternalPluginProcessLink(
            id = id,
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configId,
            actionKey = "send",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
                pluginDefinitionVersion = "1.2.3",
            ),
        )

        val dto = mapper.toProcessLinkResponseDto(processLink) as ExternalPluginProcessLinkResponseDto

        assertThat(dto.id).isEqualTo(id)
        assertThat(dto.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(dto.actionKey).isEqualTo("send")
        assertThat(dto.referenceType).isEqualTo(PluginConfigurationReferenceType.FIXED)
        assertThat(dto.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(dto.pluginVersion).isEqualTo("1.2.3")
    }

    @Test
    fun `maps a process link to an export response dto exposing the reference fields`() {
        val processLink = ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configId,
            actionKey = "send",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
                pluginDefinitionVersion = "1.2.3",
            ),
        )

        val dto = mapper.toProcessLinkExportResponseDto(processLink) as ExternalPluginProcessLinkExportResponseDto

        assertThat(dto.activityId).isEqualTo("activity-1")
        assertThat(dto.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(dto.actionKey).isEqualTo("send")
        assertThat(dto.referenceType).isEqualTo(PluginConfigurationReferenceType.FIXED)
        assertThat(dto.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(dto.pluginVersion).isEqualTo("1.2.3")
    }

    @Test
    fun `maps a deploy dto to a create request and back to an update request`() {
        val deployDto = ExternalPluginProcessLinkDeployDto(
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configId,
            actionKey = "send",
        )

        val createDto = mapper.toProcessLinkCreateRequestDto(deployDto, null)
            as ExternalPluginProcessLinkCreateRequestDto
        assertThat(createDto.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(createDto.actionKey).isEqualTo("send")

        val existingId = UUID.randomUUID()
        val updateDto = mapper.toProcessLinkUpdateRequestDto(deployDto, existingId, null)
            as ExternalPluginProcessLinkUpdateRequestDto
        assertThat(updateDto.id).isEqualTo(existingId)
        assertThat(updateDto.externalPluginConfigurationId).isEqualTo(configId)
        assertThat(updateDto.actionKey).isEqualTo("send")
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
    fun `applyPluginConfigurationMappings nulls externalPluginConfigurationId when mapping value is null`() {
        val sourceId = UUID.randomUUID()
        val node = ObjectMapper().createObjectNode().put("externalPluginConfigurationId", sourceId.toString())

        mapper.applyPluginConfigurationMappings(node, mapOf(sourceId to null))

        assertThat(node.get("externalPluginConfigurationId").isNull).isTrue()
    }

    @Test
    fun `afterImport emits detected event when FIXED link has null externalPluginConfigurationId`() {
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val link = ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = null,
            actionKey = "send",
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
    fun `afterImport emits detected event when FIXED link configuration no longer exists`() {
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val danglingConfigId = UUID.randomUUID()
        whenever(configurationRepository.existsById(danglingConfigId)).thenReturn(false)
        val link = ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = danglingConfigId,
            actionKey = "send",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
            ),
        )
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        mapper.afterImport(CaseDefinitionId("my-case", "1.0.0"), setOf("pd-1"), applicationEventPublisher)

        verify(applicationEventPublisher).publishEvent(any<CaseConfigurationIssueDetectedEvent>())
    }

    @Test
    fun `afterImport emits resolved event when all FIXED links have existing configurations`() {
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        whenever(configurationRepository.existsById(configId)).thenReturn(true)
        val link = ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = configId,
            actionKey = "send",
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

    @Test
    fun `afterImport ignores BUILDING_BLOCK links`() {
        val applicationEventPublisher: ApplicationEventPublisher = mock()
        val link = ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "pd-1",
            activityId = "activity-1",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = null,
            actionKey = "send",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.BUILDING_BLOCK,
                pluginDefinitionKey = "case-summary",
                pluginDefinitionVersion = "1.2.3",
            ),
        )
        whenever(processLinkRepository.findByProcessDefinitionId("pd-1")).thenReturn(listOf(link))

        mapper.afterImport(CaseDefinitionId("my-case", "1.0.0"), setOf("pd-1"), applicationEventPublisher)

        verify(applicationEventPublisher).publishEvent(any<CaseConfigurationIssueResolvedEvent>())
    }
}
