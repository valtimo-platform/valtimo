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

package com.ritense.valtimo.processlink.repository

import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.repository.PluginDefinitionRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.processlink.mapper.PluginProcessLinkMapper
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Correlated `NOT EXISTS` over an embedded id — most likely part to differ between PostgreSQL and MySQL. */
@Transactional
class ValtimoPluginProcessLinkRepositoryIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository

    @Autowired
    lateinit var pluginConfigurationRepository: PluginConfigurationRepository

    @Autowired
    lateinit var pluginDefinitionRepository: PluginDefinitionRepository

    @Autowired
    lateinit var entityManager: EntityManager

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var pluginProcessLinkMapper: PluginProcessLinkMapper

    @Test
    fun `should read NULL action_result_mappings as an empty list`() {
        val link = saveLink(pluginConfigurationId = null, pluginDefinitionKey = "test-plugin")
        entityManager.flush()
        jdbcTemplate.update("UPDATE process_link SET action_result_mappings = NULL WHERE id = ?", link.id)
        entityManager.clear()

        val loaded = pluginProcessLinkRepository.findById(link.id).orElseThrow()

        assertThat(loaded.actionResultMappings).isEmpty()
        assertThat(pluginProcessLinkMapper.toProcessLinkResponseDto(loaded).actionResultMappings).isEmpty()
        assertThat(pluginProcessLinkMapper.toProcessLinkExportResponseDto(loaded).actionResultMappings).isEmpty()
    }

    @Test
    fun `should not report an issue when the process definitions have no plugin links`() {
        assertThat(pluginProcessLinkRepository.existsDanglingFixedLink(listOf(PROCESS_DEFINITION_ID))).isFalse()
    }

    @Test
    fun `should report an issue for a FIXED link without a plugin configuration id`() {
        saveLink(pluginConfigurationId = null, pluginDefinitionKey = "test-plugin")

        assertThat(pluginProcessLinkRepository.existsDanglingFixedLink(listOf(PROCESS_DEFINITION_ID))).isTrue()
    }

    @Test
    fun `should report an issue for a FIXED link pointing at a missing plugin configuration`() {
        saveLink(
            pluginConfigurationId = PluginConfigurationId.existingId(UUID.randomUUID()),
            pluginDefinitionKey = "test-plugin",
        )

        assertThat(pluginProcessLinkRepository.existsDanglingFixedLink(listOf(PROCESS_DEFINITION_ID))).isTrue()
    }

    @Test
    fun `should report an issue for a FIXED link pointing at a configuration of another plugin definition`() {
        val configuration = savePluginConfiguration("test-plugin-without-configuration")
        saveLink(pluginConfigurationId = configuration.id, pluginDefinitionKey = "test-plugin")

        assertThat(pluginProcessLinkRepository.existsDanglingFixedLink(listOf(PROCESS_DEFINITION_ID))).isTrue()
    }

    @Test
    fun `should not report an issue for a FIXED link pointing at a configuration of the expected plugin`() {
        val configuration = savePluginConfiguration("test-plugin")
        saveLink(pluginConfigurationId = configuration.id, pluginDefinitionKey = "test-plugin")

        assertThat(pluginProcessLinkRepository.existsDanglingFixedLink(listOf(PROCESS_DEFINITION_ID))).isFalse()
    }

    @Test
    fun `should not report an issue for a FIXED link without an expected plugin definition key`() {
        val configuration = savePluginConfiguration("test-plugin")
        saveLink(pluginConfigurationId = configuration.id, pluginDefinitionKey = null)

        assertThat(pluginProcessLinkRepository.existsDanglingFixedLink(listOf(PROCESS_DEFINITION_ID))).isFalse()
    }

    @Test
    fun `should ignore BUILDING_BLOCK links`() {
        saveLink(
            pluginConfigurationId = null,
            pluginDefinitionKey = "test-plugin",
            referenceType = PluginConfigurationReferenceType.BUILDING_BLOCK,
        )

        assertThat(pluginProcessLinkRepository.existsDanglingFixedLink(listOf(PROCESS_DEFINITION_ID))).isFalse()
    }

    @Test
    fun `should only look at the given process definitions`() {
        saveLink(pluginConfigurationId = null, pluginDefinitionKey = "test-plugin")

        assertThat(pluginProcessLinkRepository.existsDanglingFixedLink(listOf(OTHER_PROCESS_DEFINITION_ID))).isFalse()
        assertThat(
            pluginProcessLinkRepository.existsDanglingFixedLink(
                listOf(OTHER_PROCESS_DEFINITION_ID, PROCESS_DEFINITION_ID)
            )
        ).isTrue()
    }

    @Test
    fun `should handle an empty process definition list`() {
        saveLink(pluginConfigurationId = null, pluginDefinitionKey = "test-plugin")

        assertThat(pluginProcessLinkRepository.existsDanglingFixedLink(emptyList())).isFalse()
        assertThat(pluginProcessLinkRepository.findByProcessDefinitionIdIn(emptyList())).isEmpty()
    }

    @Test
    fun `should find the links of all given process definitions in one query`() {
        saveLink(pluginConfigurationId = null, pluginDefinitionKey = "test-plugin")
        saveLink(
            pluginConfigurationId = null,
            pluginDefinitionKey = "test-plugin",
            processDefinitionId = OTHER_PROCESS_DEFINITION_ID,
        )

        val links = pluginProcessLinkRepository.findByProcessDefinitionIdIn(
            listOf(PROCESS_DEFINITION_ID, OTHER_PROCESS_DEFINITION_ID)
        )

        assertThat(links.map { it.processDefinitionId })
            .containsExactlyInAnyOrder(PROCESS_DEFINITION_ID, OTHER_PROCESS_DEFINITION_ID)
    }

    private fun savePluginConfiguration(pluginDefinitionKey: String): PluginConfiguration {
        val pluginDefinition = pluginDefinitionRepository.findById(pluginDefinitionKey).orElseThrow()
        return pluginConfigurationRepository.save(
            PluginConfiguration(
                PluginConfigurationId.newId(),
                "title",
                null,
                pluginDefinition,
            )
        )
    }

    private fun saveLink(
        pluginConfigurationId: PluginConfigurationId?,
        pluginDefinitionKey: String?,
        referenceType: PluginConfigurationReferenceType = PluginConfigurationReferenceType.FIXED,
        processDefinitionId: String = PROCESS_DEFINITION_ID,
    ): PluginProcessLink {
        return pluginProcessLinkRepository.save(
            PluginProcessLink(
                id = UUID.randomUUID(),
                processDefinitionId = processDefinitionId,
                activityId = "Task_${UUID.randomUUID()}".take(64),
                activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
                actionProperties = null,
                pluginConfigurationId = pluginConfigurationId,
                pluginConfigurationReference = PluginConfigurationReference(referenceType, pluginDefinitionKey),
                pluginActionDefinitionKey = "test-action",
            )
        )
    }

    private companion object {
        const val PROCESS_DEFINITION_ID = "dangling-link-test-pd-1"

        const val OTHER_PROCESS_DEFINITION_ID = "dangling-link-test-pd-2"
    }
}
