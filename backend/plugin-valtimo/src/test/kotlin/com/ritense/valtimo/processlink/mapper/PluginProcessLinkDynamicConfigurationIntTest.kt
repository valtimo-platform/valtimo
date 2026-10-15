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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.exporter.manifest.DependencyType
import com.ritense.exporter.manifest.StringValue
import com.ritense.plugin.domain.PluginConfigurationReferenceType.FIXED
import com.ritense.plugin.domain.PluginConfigurationReferenceType.VALUE_RESOLVER
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.web.rest.request.PluginProcessLinkCreateDto
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.web.rest.dto.ProcessLinkUpdateRequestDto
import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.RecordingTestPlugin
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.operaton.bpm.engine.RuntimeService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
class PluginProcessLinkDynamicConfigurationIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var processLinkService: ProcessLinkService

    @Autowired
    lateinit var pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository

    @Autowired
    lateinit var pluginProcessLinkMapper: PluginProcessLinkMapper

    @Autowired
    lateinit var runtimeService: RuntimeService

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @BeforeEach
    fun before() {
        RecordingTestPlugin.invokedConfigurationIds.clear()
    }

    @Test
    fun `environment placeholders in pluginConfigurationId and pluginActionDefinitionKey are stored as their property values`() {
        val link = getLink("dynamic-env-process", "RecordTask")

        assertThat(link.pluginConfigurationReference.type).isEqualTo(FIXED)
        assertThat(link.pluginConfigurationId?.id).isEqualTo(CONFIGURATION_A)
        assertThat(link.pluginActionDefinitionKey).isEqualTo("record")
        assertThat(link.pluginConfigurationIdExpression).isNull()

        runtimeService.startProcessInstanceByKey("dynamic-env-process")

        assertThat(RecordingTestPlugin.invokedConfigurationIds).containsExactly(CONFIGURATION_A)
    }

    @Test
    fun `a value-resolver pluginConfigurationId is resolved per process instance`() {
        val link = getLink("dynamic-pv-process", "RecordTask")

        assertThat(link.pluginConfigurationReference.type).isEqualTo(VALUE_RESOLVER)
        assertThat(link.pluginConfigurationReference.pluginDefinitionKey).isEqualTo("recording-test-plugin")
        assertThat(link.pluginConfigurationIdExpression).isEqualTo("pv:pluginConfigId")
        assertThat(link.pluginConfigurationId).isNull()

        runtimeService.startProcessInstanceByKey("dynamic-pv-process", mapOf("pluginConfigId" to CONFIGURATION_A.toString()))
        runtimeService.startProcessInstanceByKey("dynamic-pv-process", mapOf("pluginConfigId" to CONFIGURATION_B))

        assertThat(RecordingTestPlugin.invokedConfigurationIds).containsExactly(CONFIGURATION_A, CONFIGURATION_B)
    }

    @Test
    fun `a hardcoded pluginConfigurationId is stored and invoked as before`() {
        val link = getLink("dynamic-fixed-process", "RecordTask")

        assertThat(link.pluginConfigurationReference.type).isEqualTo(FIXED)
        assertThat(link.pluginConfigurationId?.id).isEqualTo(CONFIGURATION_A)
        assertThat(link.pluginConfigurationIdExpression).isNull()

        runtimeService.startProcessInstanceByKey("dynamic-fixed-process")

        assertThat(RecordingTestPlugin.invokedConfigurationIds).containsExactly(CONFIGURATION_A)
    }

    @Test
    fun `an unresolved placeholder is stored as a dangling link instead of failing the deployment`() {
        val link = getLink("dynamic-broken-process", "UnresolvedTask")

        assertThat(link.pluginConfigurationReference.type).isEqualTo(FIXED)
        assertThat(link.pluginConfigurationId).isNull()
        assertThat(link.pluginConfigurationIdExpression).isNull()
        assertThat(link.pluginActionDefinitionKey).isEqualTo("\${valtimo.test.missing-action}")
        assertThat(pluginProcessLinkRepository.existsDanglingFixedLink(setOf(link.processDefinitionId))).isTrue()
    }

    @Test
    fun `an unsupported pluginConfigurationId is stored as a dangling link instead of failing the deployment`() {
        val link = getLink("dynamic-broken-process", "UnsupportedTask")

        assertThat(link.pluginConfigurationReference.type).isEqualTo(FIXED)
        assertThat(link.pluginConfigurationId).isNull()
        assertThat(link.pluginConfigurationIdExpression).isNull()
    }

    @Test
    fun `runtime fails naming the activity and expression when the value resolves to nothing`() {
        assertStartFails(null, "resolved to no value")
    }

    @Test
    fun `runtime fails naming the value when it is not a UUID`() {
        assertStartFails("not-a-uuid", "resolved to 'not-a-uuid', which is not a plugin configuration id")
    }

    @Test
    fun `runtime fails naming the value when no plugin configuration has that id`() {
        val unknown = UUID.randomUUID().toString()
        assertStartFails(unknown, "resolved to '$unknown', but no plugin configuration with that id exists")
    }

    @Test
    fun `runtime fails naming the value when the configuration belongs to a different plugin`() {
        assertStartFails(
            TEST_PLUGIN_CONFIGURATION,
            "resolved to '$TEST_PLUGIN_CONFIGURATION', a configuration of plugin 'test-plugin', " +
                "but the process link expects plugin 'recording-test-plugin'"
        )
    }

    @Test
    fun `an exported value-resolver link imports again with its expression`() {
        val link = getLink("dynamic-pv-process", "RecordTask")

        val exported = objectMapper.valueToTree<ObjectNode>(pluginProcessLinkMapper.toProcessLinkExportResponseDto(link))
        assertThat(exported.path("pluginConfigurationIdExpression").asText()).isEqualTo("pv:pluginConfigId")
        exported.put("processLinkType", "plugin")
        exported.put("processDefinitionId", link.processDefinitionId)

        val deployDto = objectMapper.treeToValue<ProcessLinkDeployDto>(exported)
        val createDto = pluginProcessLinkMapper.toProcessLinkCreateRequestDto(deployDto, null)
        val reimported = pluginProcessLinkMapper.toNewProcessLink(createDto, null)

        assertThat(reimported.pluginConfigurationReference).isEqualTo(link.pluginConfigurationReference)
        assertThat(reimported.pluginConfigurationIdExpression).isEqualTo("pv:pluginConfigId")
        assertThat(reimported.pluginConfigurationId).isNull()
        assertThat(reimported.copy(id = link.id)).isEqualTo(link)
    }

    @Test
    fun `an editor update without an expression keeps the stored expression and saves the new action properties`() {
        val link = getLink("dynamic-pv-process", "RecordTask")
        val updateRequest = objectMapper.readValue(
            """
            {
                "id": "${link.id}",
                "pluginActionDefinitionKey": "record",
                "actionProperties": {"note": "changed"},
                "referenceType": "VALUE_RESOLVER",
                "pluginDefinitionKey": "recording-test-plugin",
                "actionResultMappings": []
            }
            """.trimIndent(),
            ProcessLinkUpdateRequestDto::class.java
        )

        runWithoutAuthorization {
            processLinkService.updateProcessLink(updateRequest, CaseDefinitionId.of("dynamic", "1.0.0"))
        }

        val updated = getLink("dynamic-pv-process", "RecordTask")
        assertThat(updated.pluginConfigurationReference.type).isEqualTo(VALUE_RESOLVER)
        assertThat(updated.pluginConfigurationIdExpression).isEqualTo("pv:pluginConfigId")
        assertThat(updated.actionProperties?.path("note")?.asText()).isEqualTo("changed")
    }

    @Test
    fun `exporting a value-resolver link lists its plugin as a manifest dependency`() {
        val link = getLink("dynamic-pv-process", "RecordTask")

        val dependencies = pluginProcessLinkMapper.toManifestDependencies(link)

        assertThat(dependencies).hasSize(1)
        assertThat(dependencies.single().type).isEqualTo(DependencyType.PLUGIN)
        assertThat((dependencies.single().key as StringValue).value).isEqualTo("recording-test-plugin")
    }

    private fun assertStartFails(pluginConfigId: String?, expectedMessage: String) {
        val exception = assertThrows<Exception> {
            runtimeService.startProcessInstanceByKey("dynamic-pv-process", mapOf("pluginConfigId" to pluginConfigId))
        }

        val messages = generateSequence<Throwable>(exception) { it.cause }.mapNotNull { it.message }.toList()
        assertThat(messages).anySatisfy { message ->
            assertThat(message)
                .contains("activity 'RecordTask'")
                .contains("pluginConfigurationId 'pv:pluginConfigId'")
                .contains(expectedMessage)
        }
        assertThat(RecordingTestPlugin.invokedConfigurationIds).isEmpty()
    }

    private fun getLink(processDefinitionKey: String, activityId: String): PluginProcessLink {
        return runWithoutAuthorization {
            processLinkService.getProcessLinksByProcessDefinitionKey(processDefinitionKey)
        }.filterIsInstance<PluginProcessLink>().single { it.activityId == activityId }
    }

    companion object {
        private val CONFIGURATION_A = UUID.fromString("7b1c0a52-2a4e-4d0e-9a51-1f0e4d2c9a01")
        private val CONFIGURATION_B = UUID.fromString("7b1c0a52-2a4e-4d0e-9a51-1f0e4d2c9a02")
        private const val TEST_PLUGIN_CONFIGURATION = "0a750334-a065-48fa-bb02-293d21df2213"
    }
}
