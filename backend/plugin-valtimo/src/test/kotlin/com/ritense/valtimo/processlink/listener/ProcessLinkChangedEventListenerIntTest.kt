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

package com.ritense.valtimo.processlink.listener

import com.ritense.case.domain.CaseDefinitionConfigurationIssue
import com.ritense.case.repository.CaseDefinitionConfigurationIssueRepository
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.domain.PluginConfigurationReference
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.plugin.domain.PluginProcessLink
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.repository.PluginDefinitionRepository
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinition
import com.ritense.processdocument.domain.ProcessDefinitionCaseDefinitionId
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.repository.ProcessDefinitionCaseDefinitionRepository
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.event.ProcessLinkDeletedEvent
import com.ritense.processlink.event.ProcessLinksDeployedEvent
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.processlink.mapper.PluginProcessLinkMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

/**
 * Deliberately **not** `@Transactional`: the listeners under test run in the `AFTER_COMMIT` phase, so a test
 * that never commits would not trigger them at all. Every step opens its own transaction instead.
 */
class ProcessLinkChangedEventListenerIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var configurationIssueRepository: CaseDefinitionConfigurationIssueRepository

    @Autowired
    lateinit var applicationEventPublisher: ApplicationEventPublisher

    @Autowired
    lateinit var transactionTemplate: TransactionTemplate

    @Autowired
    lateinit var pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository

    @Autowired
    lateinit var pluginConfigurationRepository: PluginConfigurationRepository

    @Autowired
    lateinit var pluginDefinitionRepository: PluginDefinitionRepository

    @Autowired
    lateinit var processDefinitionCaseDefinitionRepository: ProcessDefinitionCaseDefinitionRepository

    @AfterEach
    fun cleanup() {
        transactionTemplate.executeWithoutResult {
            configurationIssueRepository.deleteByCaseDefinitionId(CASE_DEFINITION_ID)
            pluginProcessLinkRepository.deleteAll(
                pluginProcessLinkRepository.findByProcessDefinitionId(LINKED_PROCESS_DEFINITION_ID)
            )
            processDefinitionCaseDefinitionRepository.findByIdCaseDefinitionId(CASE_DEFINITION_ID)
                .forEach { processDefinitionCaseDefinitionRepository.delete(it) }
            pluginConfigurationRepository.findAll()
                .filter { it.title == PLUGIN_CONFIGURATION_TITLE }
                .forEach { pluginConfigurationRepository.delete(it) }
        }
    }

    @Test
    fun `resolves the issue when a deployment leaves the case definition without dangling plugin links`() {
        givenUnresolvedPluginProcessLinkIssue()

        transactionTemplate.executeWithoutResult {
            applicationEventPublisher.publishEvent(
                ProcessLinksDeployedEvent("some-process-definition-id", CASE_DEFINITION_ID)
            )
        }

        assertThat(configurationIssueRepository.findUnresolvedByCaseDefinitionId(CASE_DEFINITION_ID)).isEmpty()
    }

    @Test
    fun `keeps the issue unresolved when the deployment is not for a case definition`() {
        givenUnresolvedPluginProcessLinkIssue()

        transactionTemplate.executeWithoutResult {
            applicationEventPublisher.publishEvent(ProcessLinksDeployedEvent("some-process-definition-id", null))
        }

        assertThat(configurationIssueRepository.findUnresolvedByCaseDefinitionId(CASE_DEFINITION_ID)).hasSize(1)
    }

    @Test
    fun `keeps the issue unresolved when the process definition is not linked to a case definition`() {
        givenUnresolvedPluginProcessLinkIssue()

        transactionTemplate.executeWithoutResult {
            applicationEventPublisher.publishEvent(
                ProcessLinkDeletedEvent("plugin", "some-unlinked-process-definition-id")
            )
        }

        assertThat(configurationIssueRepository.findUnresolvedByCaseDefinitionId(CASE_DEFINITION_ID)).hasSize(1)
    }

    @Test
    fun `keeps the issue unresolved when a link points at a configuration of another plugin definition`() {
        givenUnresolvedPluginProcessLinkIssue()
        givenLinkedProcessDefinitionWithPluginLink(
            configurationPluginKey = "test-plugin-without-configuration",
            expectedPluginKey = "test-plugin",
        )

        transactionTemplate.executeWithoutResult {
            applicationEventPublisher.publishEvent(
                ProcessLinksDeployedEvent(LINKED_PROCESS_DEFINITION_ID, CASE_DEFINITION_ID)
            )
        }

        assertThat(configurationIssueRepository.findUnresolvedByCaseDefinitionId(CASE_DEFINITION_ID)).hasSize(1)
    }

    @Test
    fun `resolves the issue when a link points at a configuration of the expected plugin definition`() {
        givenUnresolvedPluginProcessLinkIssue()
        givenLinkedProcessDefinitionWithPluginLink(
            configurationPluginKey = "test-plugin",
            expectedPluginKey = "test-plugin",
        )

        transactionTemplate.executeWithoutResult {
            applicationEventPublisher.publishEvent(
                ProcessLinksDeployedEvent(LINKED_PROCESS_DEFINITION_ID, CASE_DEFINITION_ID)
            )
        }

        assertThat(configurationIssueRepository.findUnresolvedByCaseDefinitionId(CASE_DEFINITION_ID)).isEmpty()
    }

    private fun givenUnresolvedPluginProcessLinkIssue() {
        transactionTemplate.executeWithoutResult {
            configurationIssueRepository.save(
                CaseDefinitionConfigurationIssue(
                    caseDefinitionId = CASE_DEFINITION_ID,
                    issueType = PluginProcessLinkMapper.ISSUE_TYPE,
                )
            )
        }
    }

    private fun givenLinkedProcessDefinitionWithPluginLink(
        configurationPluginKey: String,
        expectedPluginKey: String,
    ) {
        transactionTemplate.executeWithoutResult {
            processDefinitionCaseDefinitionRepository.save(
                ProcessDefinitionCaseDefinition(
                    id = ProcessDefinitionCaseDefinitionId(
                        processDefinitionId = ProcessDefinitionId.of(LINKED_PROCESS_DEFINITION_ID),
                        caseDefinitionId = CASE_DEFINITION_ID,
                    )
                )
            )
            val pluginDefinition = pluginDefinitionRepository.findById(configurationPluginKey).orElseThrow()
            val configuration = pluginConfigurationRepository.save(
                PluginConfiguration(
                    PluginConfigurationId.newId(),
                    PLUGIN_CONFIGURATION_TITLE,
                    null,
                    pluginDefinition,
                )
            )
            pluginProcessLinkRepository.save(
                PluginProcessLink(
                    id = UUID.randomUUID(),
                    processDefinitionId = LINKED_PROCESS_DEFINITION_ID,
                    activityId = "Task_1",
                    activityType = ActivityTypeWithEventName.SERVICE_TASK_START,
                    actionProperties = null,
                    pluginConfigurationId = configuration.id,
                    pluginConfigurationReference = PluginConfigurationReference(
                        PluginConfigurationReferenceType.FIXED,
                        expectedPluginKey,
                    ),
                    pluginActionDefinitionKey = "test-action",
                )
            )
        }
    }

    companion object {
        private val CASE_DEFINITION_ID = CaseDefinitionId.of("recheck-issues-test", "1.0.0")

        private const val LINKED_PROCESS_DEFINITION_ID = "recheck-issues-test-pd"

        private const val PLUGIN_CONFIGURATION_TITLE = "recheck-issues-test-configuration"
    }
}
