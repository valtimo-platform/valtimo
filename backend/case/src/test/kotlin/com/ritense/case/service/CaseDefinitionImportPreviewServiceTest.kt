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

package com.ritense.case.service

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.importer.exception.ImportServiceException
import com.ritense.valtimo.contract.plugin.PluginConfigurationExistenceChecker
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class CaseDefinitionImportPreviewServiceTest {

    private val objectMapper = jacksonObjectMapper()
    private val service = CaseDefinitionImportPreviewService(objectMapper, null)

    @Test
    fun `should return preview from valid ZIP`() {
        val zip = createZip(
            "case/definition/my-case.case-definition.json" to """
                {
                    "key": "my-case",
                    "name": "My Case",
                    "versionTag": "1.0.0",
                    "final": false
                }
            """.trimIndent()
        )

        val result = service.preview(ByteArrayInputStream(zip))

        assertThat(result.key).isEqualTo("my-case")
        assertThat(result.name).isEqualTo("My Case")
        assertThat(result.versionTag).isEqualTo("1.0.0")
        assertThat(result.isFinal).isFalse()
    }

    @Test
    fun `should return preview with final flag`() {
        val zip = createZip(
            "case/definition/my-case.case-definition.json" to """
                {
                    "key": "my-case",
                    "name": "My Final Case",
                    "versionTag": "2.0.0",
                    "final": true
                }
            """.trimIndent()
        )

        val result = service.preview(ByteArrayInputStream(zip))

        assertThat(result.key).isEqualTo("my-case")
        assertThat(result.name).isEqualTo("My Final Case")
        assertThat(result.versionTag).isEqualTo("2.0.0")
        assertThat(result.isFinal).isTrue()
    }

    @Test
    fun `should throw when ZIP has no case-definition json`() {
        val zip = createZip(
            "some/other/file.json" to """{"key": "test"}"""
        )

        assertThatThrownBy { service.preview(ByteArrayInputStream(zip)) }
            .isInstanceOf(ImportServiceException::class.java)
            .hasMessageContaining("No .case-definition.json found in ZIP")
    }

    @Test
    fun `should throw for empty ZIP`() {
        val baos = ByteArrayOutputStream()
        ZipOutputStream(baos).use { it.finish() }

        assertThatThrownBy { service.preview(ByteArrayInputStream(baos.toByteArray())) }
            .isInstanceOf(ImportServiceException::class.java)
    }

    @Test
    fun `should extract plugin configurations from process-link files`() {
        val pluginConfigId = UUID.randomUUID()
        val checker = PluginConfigurationExistenceChecker { false }
        val serviceWithChecker = CaseDefinitionImportPreviewService(objectMapper, checker)

        val zip = createZip(
            "case/definition/my-case.case-definition.json" to """
                {
                    "key": "my-case",
                    "name": "My Case",
                    "versionTag": "1.0.0",
                    "final": false
                }
            """.trimIndent(),
            "process-link/my-process.process-link.json" to """
                [
                    {
                        "activityId": "Task_1",
                        "activityType": "bpmn:ServiceTask:start",
                        "processLinkType": "plugin",
                        "pluginConfigurationId": "$pluginConfigId",
                        "referenceType": "FIXED",
                        "pluginDefinitionKey": "zaken-api",
                        "pluginActionDefinitionKey": "create-zaak",
                        "actionProperties": {}
                    }
                ]
            """.trimIndent()
        )

        val result = serviceWithChecker.preview(ByteArrayInputStream(zip))

        assertThat(result.pluginConfigurations).hasSize(1)
        val config = result.pluginConfigurations[0]
        assertThat(config.pluginConfigurationId).isEqualTo(pluginConfigId)
        assertThat(config.pluginDefinitionKey).isEqualTo("zaken-api")
        assertThat(config.pluginActionDefinitionKey).isEqualTo("create-zaak")
        assertThat(config.processDefinitionKey).isEqualTo("my-process")
        assertThat(config.activityId).isEqualTo("Task_1")
        assertThat(config.existsInTargetEnvironment).isFalse()
    }

    @Test
    fun `should mark existing plugin configuration as exists in target`() {
        val existingId = UUID.randomUUID()
        val checker = PluginConfigurationExistenceChecker { id -> id == existingId }
        val serviceWithChecker = CaseDefinitionImportPreviewService(objectMapper, checker)

        val zip = createZip(
            "case/definition/my-case.case-definition.json" to """
                {
                    "key": "my-case",
                    "name": "My Case",
                    "versionTag": "1.0.0",
                    "final": false
                }
            """.trimIndent(),
            "process-link/my-process.process-link.json" to """
                [
                    {
                        "activityId": "Task_1",
                        "activityType": "bpmn:ServiceTask:start",
                        "processLinkType": "plugin",
                        "pluginConfigurationId": "$existingId",
                        "referenceType": "FIXED",
                        "pluginDefinitionKey": "zaken-api",
                        "pluginActionDefinitionKey": "create-zaak",
                        "actionProperties": {}
                    }
                ]
            """.trimIndent()
        )

        val result = serviceWithChecker.preview(ByteArrayInputStream(zip))

        assertThat(result.pluginConfigurations).hasSize(1)
        assertThat(result.pluginConfigurations[0].existsInTargetEnvironment).isTrue()
    }

    @Test
    fun `should skip BUILDING_BLOCK process links in preview`() {
        val zip = createZip(
            "case/definition/my-case.case-definition.json" to """
                {
                    "key": "my-case",
                    "name": "My Case",
                    "versionTag": "1.0.0",
                    "final": false
                }
            """.trimIndent(),
            "process-link/my-process.process-link.json" to """
                [
                    {
                        "activityId": "Task_1",
                        "activityType": "bpmn:ServiceTask:start",
                        "processLinkType": "plugin",
                        "referenceType": "BUILDING_BLOCK",
                        "pluginDefinitionKey": "zaken-api",
                        "pluginActionDefinitionKey": "create-zaak",
                        "actionProperties": {}
                    }
                ]
            """.trimIndent()
        )

        val result = service.preview(ByteArrayInputStream(zip))

        assertThat(result.pluginConfigurations).isEmpty()
    }

    @Test
    fun `should return empty plugin configurations when no process-link files`() {
        val zip = createZip(
            "case/definition/my-case.case-definition.json" to """
                {
                    "key": "my-case",
                    "name": "My Case",
                    "versionTag": "1.0.0",
                    "final": false
                }
            """.trimIndent()
        )

        val result = service.preview(ByteArrayInputStream(zip))

        assertThat(result.pluginConfigurations).isEmpty()
    }

    private fun createZip(vararg entries: Pair<String, String>): ByteArray {
        val baos = ByteArrayOutputStream()
        ZipOutputStream(baos).use { zos ->
            for ((name, content) in entries) {
                zos.putNextEntry(ZipEntry(name))
                zos.write(content.toByteArray())
                zos.closeEntry()
            }
        }
        return baos.toByteArray()
    }
}
