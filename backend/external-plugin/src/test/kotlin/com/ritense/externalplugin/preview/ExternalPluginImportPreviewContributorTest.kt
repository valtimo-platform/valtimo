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

package com.ritense.externalplugin.preview

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.valtimo.contract.importer.ImportPreviewContribution.Companion.SOURCE_EXTERNAL
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.time.Instant
import java.util.Optional
import java.util.UUID

class ExternalPluginImportPreviewContributorTest {

    private lateinit var configurationRepository: ExternalPluginConfigurationRepository
    private lateinit var definitionRepository: ExternalPluginDefinitionRepository
    private lateinit var contributor: ExternalPluginImportPreviewContributor

    @BeforeEach
    fun setUp() {
        configurationRepository = mock()
        definitionRepository = mock()
        contributor = ExternalPluginImportPreviewContributor(ObjectMapper(), configurationRepository, definitionRepository)
    }

    @Test
    fun `contributes an entry for a FIXED external_plugin process link and checks existence`() {
        val configId = UUID.randomUUID()
        whenever(configurationRepository.existsById(configId)).thenReturn(true)

        val json = """
            [
              {
                "activityId": "Task_1",
                "activityType": "bpmn:ServiceTask:start",
                "processLinkType": "external_plugin",
                "externalPluginConfigurationId": "$configId",
                "actionKey": "send",
                "referenceType": "FIXED",
                "pluginDefinitionKey": "case-summary",
                "pluginVersion": "1.2.3"
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("process-link/my-process.process-link.json" to json.toByteArray())
        )

        assertThat(result).hasSize(1)
        val entry = result.single()
        assertThat(entry.pluginConfigurationId).isEqualTo(configId)
        assertThat(entry.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(entry.pluginDefinitionVersion).isEqualTo("1.2.3")
        assertThat(entry.processDefinitionKey).isEqualTo("my-process")
        assertThat(entry.activityId).isEqualTo("Task_1")
        assertThat(entry.source).isEqualTo(SOURCE_EXTERNAL)
        assertThat(entry.existsInTargetEnvironment).isTrue()
    }

    @Test
    fun `contributes an entry for an external_plugin_task_form process link`() {
        val configId = UUID.randomUUID()
        whenever(configurationRepository.existsById(configId)).thenReturn(false)

        val json = """
            [
              {
                "activityId": "Task_1",
                "activityType": "bpmn:UserTask:create",
                "processLinkType": "external_plugin_task_form",
                "externalPluginConfigurationId": "$configId",
                "referenceType": "FIXED",
                "pluginVersion": "0.1.0"
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("process-link/my-process.process-link.json" to json.toByteArray())
        )

        assertThat(result).hasSize(1)
        assertThat(result.single().existsInTargetEnvironment).isFalse()
        assertThat(result.single().source).isEqualTo(SOURCE_EXTERNAL)
    }

    @Test
    fun `ignores BUILDING_BLOCK external plugin references (no configuration id to check)`() {
        val json = """
            [
              {
                "activityId": "Task_1",
                "activityType": "bpmn:ServiceTask:start",
                "processLinkType": "external_plugin",
                "actionKey": "send",
                "referenceType": "BUILDING_BLOCK",
                "pluginDefinitionKey": "case-summary",
                "pluginVersion": "1.2.3"
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("process-link/my-process.process-link.json" to json.toByteArray())
        )

        assertThat(result).isEmpty()
    }

    @Test
    fun `ignores embedded plugin process links`() {
        val json = """
            [
              {
                "activityId": "Task_1",
                "activityType": "bpmn:ServiceTask:start",
                "processLinkType": "plugin",
                "pluginConfigurationId": "${UUID.randomUUID()}",
                "pluginActionDefinitionKey": "create-zaak"
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("process-link/my-process.process-link.json" to json.toByteArray())
        )

        assertThat(result).isEmpty()
    }

    @Test
    fun `contributes an entry for an EXTERNAL_PLUGIN case tab with the resolved plugin key and version`() {
        val configId = UUID.randomUUID()
        val definitionId = UUID.randomUUID()
        whenever(configurationRepository.findById(configId)).thenReturn(
            Optional.of(
                ExternalPluginConfiguration(
                    id = configId,
                    definitionId = definitionId,
                    title = "Config",
                    createdAt = Instant.now(),
                )
            )
        )
        whenever(definitionRepository.findById(definitionId)).thenReturn(
            Optional.of(
                ExternalPluginDefinition(
                    id = definitionId,
                    pluginId = "case-summary",
                    version = "0.1.0",
                    hostId = UUID.randomUUID(),
                    baseUrl = "http://localhost:1234",
                    status = ExternalPluginDefinitionStatus.AVAILABLE,
                )
            )
        )

        val json = """
            [
              {
                "key": "summary",
                "name": "Summary",
                "type": "external_plugin",
                "contentKey": "$configId:bundle-key"
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("case/tab/my-doc.case-tab.json" to json.toByteArray())
        )

        assertThat(result).hasSize(1)
        val entry = result.single()
        assertThat(entry.pluginConfigurationId).isEqualTo(configId)
        assertThat(entry.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(entry.pluginDefinitionVersion).isEqualTo("0.1.0")
        assertThat(entry.source).isEqualTo(SOURCE_EXTERNAL)
        assertThat(entry.existsInTargetEnvironment).isTrue()
    }

    @Test
    fun `an EXTERNAL_PLUGIN case tab whose configuration is unknown stays a key-less entry`() {
        val configId = UUID.randomUUID()
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.empty())

        val json = """
            [
              {
                "key": "summary",
                "name": "Summary",
                "type": "external_plugin",
                "contentKey": "$configId:bundle-key"
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("case/tab/my-doc.case-tab.json" to json.toByteArray())
        )

        assertThat(result).hasSize(1)
        assertThat(result.single().pluginDefinitionKey).isNull()
        assertThat(result.single().existsInTargetEnvironment).isFalse()
    }

    @Test
    fun `a self-describing EXTERNAL_PLUGIN case tab stays identifiable when its configuration was deleted`() {
        val configId = UUID.randomUUID()
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.empty())

        val json = """
            [
              {
                "key": "summary",
                "name": "Summary",
                "type": "external_plugin",
                "contentKey": "$configId:bundle-key",
                "pluginDefinitionKey": "case-summary",
                "pluginVersion": "0.1.0"
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("case/tab/my-doc.case-tab.json" to json.toByteArray())
        )

        assertThat(result).hasSize(1)
        val entry = result.single()
        assertThat(entry.pluginConfigurationId).isEqualTo(configId)
        // Read from the export, not from the (deleted) configuration — so the row is mappable.
        assertThat(entry.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(entry.pluginDefinitionVersion).isEqualTo("0.1.0")
        assertThat(entry.existsInTargetEnvironment).isFalse()
        assertThat(entry.source).isEqualTo(SOURCE_EXTERNAL)
    }

    @Test
    fun `contributes an entry for an external-plugin case widget with the resolved plugin key and version`() {
        val configId = UUID.randomUUID()
        val definitionId = UUID.randomUUID()
        whenever(configurationRepository.findById(configId)).thenReturn(
            Optional.of(
                ExternalPluginConfiguration(
                    id = configId,
                    definitionId = definitionId,
                    title = "Config",
                    createdAt = Instant.now(),
                )
            )
        )
        whenever(definitionRepository.findById(definitionId)).thenReturn(
            Optional.of(
                ExternalPluginDefinition(
                    id = definitionId,
                    pluginId = "case-summary",
                    version = "0.1.0",
                    hostId = UUID.randomUUID(),
                    baseUrl = "http://localhost:1234",
                    status = ExternalPluginDefinitionStatus.AVAILABLE,
                )
            )
        )

        val json = """
            [
              {
                "key": "widgets-tab",
                "widgets": [
                  { "type": "fields", "key": "some-fields" },
                  {
                    "type": "external-plugin",
                    "key": "summary-widget",
                    "title": "Summary",
                    "width": 2,
                    "highContrast": false,
                    "properties": { "configurationId": "$configId", "bundleKey": "summary-widget" }
                  }
                ]
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("config/case/my-doc/1-0-0/case/widget-tab/my-doc.case-widget-tab.json" to json.toByteArray())
        )

        assertThat(result).hasSize(1)
        val entry = result.single()
        assertThat(entry.pluginConfigurationId).isEqualTo(configId)
        assertThat(entry.pluginActionDefinitionKey).isEqualTo("case-widget")
        assertThat(entry.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(entry.pluginDefinitionVersion).isEqualTo("0.1.0")
        assertThat(entry.activityId).isEqualTo("widgets-tab/summary-widget")
        assertThat(entry.source).isEqualTo(SOURCE_EXTERNAL)
        assertThat(entry.existsInTargetEnvironment).isTrue()
    }

    @Test
    fun `a self-describing external-plugin case widget stays identifiable when its configuration was deleted`() {
        val configId = UUID.randomUUID()
        whenever(configurationRepository.findById(configId)).thenReturn(Optional.empty())

        val json = """
            [
              {
                "key": "widgets-tab",
                "widgets": [
                  {
                    "type": "external-plugin",
                    "key": "summary-widget",
                    "title": "Summary",
                    "width": 2,
                    "highContrast": false,
                    "properties": {
                      "configurationId": "$configId",
                      "bundleKey": "summary-widget",
                      "pluginDefinitionKey": "case-summary",
                      "pluginDefinitionVersion": "0.1.0"
                    }
                  }
                ]
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("config/case/my-doc/1-0-0/case/widget-tab/my-doc.case-widget-tab.json" to json.toByteArray())
        )

        assertThat(result).hasSize(1)
        val entry = result.single()
        assertThat(entry.pluginConfigurationId).isEqualTo(configId)
        assertThat(entry.pluginDefinitionKey).isEqualTo("case-summary")
        assertThat(entry.pluginDefinitionVersion).isEqualTo("0.1.0")
        assertThat(entry.existsInTargetEnvironment).isFalse()
        assertThat(entry.source).isEqualTo(SOURCE_EXTERNAL)
    }

    @Test
    fun `ignores non-external-plugin widgets in a case widget tab`() {
        val json = """
            [
              {
                "key": "widgets-tab",
                "widgets": [
                  { "type": "fields", "key": "some-fields" },
                  { "type": "custom", "key": "some-custom", "properties": { "componentKey": "x" } }
                ]
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("config/case/my-doc/1-0-0/case/widget-tab/my-doc.case-widget-tab.json" to json.toByteArray())
        )

        assertThat(result).isEmpty()
    }

    @Test
    fun `ignores non-EXTERNAL_PLUGIN case tabs`() {
        val json = """
            [
              {
                "key": "summary",
                "name": "Summary",
                "type": "widgets",
                "contentKey": "widget-key"
              }
            ]
        """.trimIndent()

        val result = contributor.contributePreview(
            mapOf("case/tab/my-doc.case-tab.json" to json.toByteArray())
        )

        assertThat(result).isEmpty()
    }

    @Test
    fun `ignores unrelated files`() {
        val result = contributor.contributePreview(
            mapOf("case/definition/my-doc.case-definition.json" to "{}".toByteArray())
        )

        assertThat(result).isEmpty()
    }
}
