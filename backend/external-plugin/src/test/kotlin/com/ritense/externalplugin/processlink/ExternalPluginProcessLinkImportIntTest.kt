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

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.authorization.AuthorizationContext
import com.ritense.externalplugin.BaseIntegrationTest
import com.ritense.externalplugin.domain.ExternalPluginConfiguration
import com.ritense.externalplugin.domain.ExternalPluginDefinition
import com.ritense.externalplugin.domain.ExternalPluginDefinitionStatus
import com.ritense.externalplugin.domain.ExternalPluginHost
import com.ritense.externalplugin.domain.ExternalPluginHostStatus
import com.ritense.externalplugin.domain.ExternalPluginProcessLink
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.importer.ImportRequest
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.processlink.importer.ProcessLinkImporter
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@Transactional
class ExternalPluginProcessLinkImportIntTest @Autowired constructor(
    private val processLinkImporter: ProcessLinkImporter,
    private val processLinkRepository: ExternalPluginProcessLinkRepository,
    private val hostRepository: ExternalPluginHostRepository,
    private val definitionRepository: ExternalPluginDefinitionRepository,
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val repositoryService: OperatonRepositoryService,
) : BaseIntegrationTest() {

    @Test
    fun `import maps a FIXED external plugin link to the seeded configuration`() {
        val configuration = seedConfiguration()
        val sourceConfigurationId = UUID.randomUUID()

        processLinkImporter.import(
            ImportRequest(
                "/process-link/$PROCESS_DEFINITION_KEY.process-link.json",
                fixture(sourceConfigurationId).toByteArray(Charsets.UTF_8),
                null,
                null,
                null,
                null,
                mapOf(sourceConfigurationId to configuration.id),
            )
        )

        val processDefinition = getLatestProcessDefinition()
        val processLink = requireNotNull(
            processLinkRepository.findByProcessDefinitionId(processDefinition).singleOrNull()
        )

        assertThat(processLink.externalPluginConfigurationId).isEqualTo(configuration.id)
        assertThat(processLink.pluginConfigurationReference.type).isEqualTo(PluginConfigurationReferenceType.FIXED)
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionKey).isEqualTo(PLUGIN_ID)
        assertThat(processLink.pluginConfigurationReference.pluginDefinitionVersion).isEqualTo(PLUGIN_VERSION)
        assertThat(processLink.actionKey).isEqualTo(ACTION_KEY)
        assertThat(processLink.actionResultMappings).isEmpty()
    }

    @Test
    fun `import without a target mapping leaves the configuration id dangling`() {
        val sourceConfigurationId = UUID.randomUUID()

        processLinkImporter.import(
            ImportRequest(
                "/process-link/$PROCESS_DEFINITION_KEY.process-link.json",
                fixture(sourceConfigurationId).toByteArray(Charsets.UTF_8),
                null,
                null,
                null,
                null,
                mapOf(sourceConfigurationId to null),
            )
        )

        val processDefinition = getLatestProcessDefinition()
        val processLink = requireNotNull(
            processLinkRepository.findByProcessDefinitionId(processDefinition).singleOrNull()
        )

        assertThat(processLink.externalPluginConfigurationId).isNull()
        assertThat(processLink.pluginConfigurationReference.type).isEqualTo(PluginConfigurationReferenceType.FIXED)
    }

    private fun seedConfiguration(): ExternalPluginConfiguration {
        val host = hostRepository.save(
            ExternalPluginHost(
                id = UUID.randomUUID(),
                name = "Test host",
                baseUrl = "http://localhost:1234",
                secret = "secret",
                status = ExternalPluginHostStatus.CONNECTED,
            )
        )
        val definition = definitionRepository.save(
            ExternalPluginDefinition(
                id = UUID.randomUUID(),
                pluginId = PLUGIN_ID,
                version = PLUGIN_VERSION,
                hostId = host.id,
                baseUrl = host.baseUrl,
                status = ExternalPluginDefinitionStatus.AVAILABLE,
            )
        )
        return configurationRepository.save(
            ExternalPluginConfiguration(
                id = UUID.randomUUID(),
                definitionId = definition.id,
                title = "Test configuration",
                createdAt = Instant.now(),
            )
        )
    }

    private fun getLatestProcessDefinition(): String {
        return AuthorizationContext.runWithoutAuthorization {
            requireNotNull(repositoryService.findLatestProcessDefinition(PROCESS_DEFINITION_KEY)).id
        }
    }

    private fun fixture(externalPluginConfigurationId: UUID): String {
        // processDefinitionId is intentionally absent — ProcessLinkImporter resolves the latest
        // deployed definition for the file's key and sets it on the node itself.
        return """
            [
                {
                    "activityId": "my-service-task",
                    "activityType": "bpmn:ServiceTask:start",
                    "processLinkType": "external_plugin",
                    "externalPluginConfigurationId": "$externalPluginConfigurationId",
                    "actionKey": "$ACTION_KEY",
                    "referenceType": "FIXED",
                    "actionResultMappings": []
                }
            ]
        """.trimIndent()
    }

    private companion object {
        const val PROCESS_DEFINITION_KEY = "external-plugin-import-process"
        const val PLUGIN_ID = "test-plugin"
        const val PLUGIN_VERSION = "1.0.0"
        const val ACTION_KEY = "test-action"
    }
}
