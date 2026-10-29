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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.databind.node.TextNode
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.preview.ExternalPluginImportPreviewContributor
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.time.Instant
import java.util.Optional
import java.util.UUID

/**
 * Round-trips a `FIXED` external plugin process link through the same steps the case
 * export/import wizard performs — export DTO → JSON → import preview → deploy DTO with a
 * configuration mapping → new link → export DTO → JSON → import preview — pinning that a link
 * created *by import* keeps surfacing in the next import's configuration-matching step.
 */
class ExternalPluginProcessLinkExportImportRoundTripTest {

    private val objectMapper = MapperSingleton.get()
    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var mapper: ExternalPluginProcessLinkMapper
    private lateinit var contributor: ExternalPluginImportPreviewContributor

    private val sourceConfigId = UUID.randomUUID()
    private val targetConfigId = UUID.randomUUID()
    private val definitionId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        definitionRepository = mock()
        mapper = ExternalPluginProcessLinkMapper(
            objectMapper,
            configurationRepository,
            definitionRepository,
            mock<ExternalPluginProcessLinkRepository>(),
        )
        contributor = ExternalPluginImportPreviewContributor(objectMapper, configurationRepository, definitionRepository)

        val definition = ExternalPluginDefinition(
            id = definitionId,
            pluginId = "case-summary",
            version = "0.1.0",
            hostId = UUID.randomUUID(),
            baseUrl = "http://localhost:1234",
            status = ExternalPluginDefinitionStatus.AVAILABLE,
        )
        val targetConfiguration = ExternalPluginConfiguration(
            id = targetConfigId,
            definitionId = definitionId,
            title = "Target configuration",
            createdAt = Instant.now(),
        )
        whenever(configurationRepository.findById(targetConfigId)).thenReturn(Optional.of(targetConfiguration))
        whenever(definitionRepository.findById(definitionId)).thenReturn(Optional.of(definition))
        whenever(configurationRepository.existsById(any())).thenReturn(true)
    }

    @Test
    fun `a link created by import with a remapped configuration surfaces in the next import preview`() {
        // A link as configured through the UI (export #1's source).
        val originalLink = ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "process-def-v1",
            activityId = "my-service-task",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = sourceConfigId,
            actionKey = "case-summary",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
                pluginDefinitionVersion = "0.1.0",
            ),
        )

        val export1 = export(originalLink)
        val preview1 = preview("config/case/bezwaar/1-0-1/process-link/proc.process-link.json", export1)
        assertThat(preview1).hasSize(1)
        assertThat(preview1.single().pluginConfigurationId).isEqualTo(sourceConfigId)

        // Import export #1 the way ProcessLinkImporter does, with the wizard mapping the source
        // configuration to the target configuration.
        val importedLink = importLink(export1, mapOf(sourceConfigId to targetConfigId))
        assertThat(importedLink.externalPluginConfigurationId).isEqualTo(targetConfigId)

        // Export the imported case (#2) and run the next import's preview over it.
        val export2 = export(importedLink)
        val preview2 = preview("config/case/bezwaar-2/1-0-1/process-link/proc.process-link.json", export2)
        assertThat(preview2).hasSize(1)
        assertThat(preview2.single().pluginConfigurationId).isEqualTo(targetConfigId)
    }

    @Test
    fun `a link imported dangling (no mapping chosen) is absent from the next import preview`() {
        val originalLink = ExternalPluginProcessLink(
            id = UUID.randomUUID(),
            processDefinitionId = "process-def-v1",
            activityId = "my-service-task",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
            externalPluginConfigurationId = sourceConfigId,
            actionKey = "case-summary",
            pluginConfigurationReference = PluginConfigurationReference(
                type = PluginConfigurationReferenceType.FIXED,
                pluginDefinitionKey = "case-summary",
                pluginDefinitionVersion = "0.1.0",
            ),
        )

        val importedLink = importLink(export(originalLink), mapOf(sourceConfigId to null))
        assertThat(importedLink.externalPluginConfigurationId).isNull()

        // A dangling link has no configuration id to match, so the preview cannot offer a row.
        val preview = preview("config/case/bezwaar-2/1-0-1/process-link/proc.process-link.json", export(importedLink))
        assertThat(preview).isEmpty()
    }

    private fun export(link: ExternalPluginProcessLink): ByteArray =
        objectMapper.writeValueAsBytes(listOf(mapper.toProcessLinkExportResponseDto(link)))

    private fun preview(fileName: String, content: ByteArray) =
        contributor.contributePreview(mapOf(fileName to content))

    /** The per-node steps of `ProcessLinkImporter.import`. */
    private fun importLink(exportedJson: ByteArray, mappings: Map<UUID, UUID?>): ExternalPluginProcessLink {
        val tree = objectMapper.readTree(exportedJson.toString(Charsets.UTF_8)) as ArrayNode
        val node = tree[0] as ObjectNode
        if (!node.has("processDefinitionId")) {
            node.set<JsonNode>("processDefinitionId", TextNode.valueOf("process-def-v2"))
        }
        mapper.applyPluginConfigurationMappings(node, mappings)
        val deployDto = objectMapper.treeToValue(node, ProcessLinkDeployDto::class.java)
        val createDto = mapper.toProcessLinkCreateRequestDto(deployDto, null)
        return mapper.toNewProcessLink(createDto, null) as ExternalPluginProcessLink
    }
}
