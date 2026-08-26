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
import com.ritense.processlink.event.ProcessLinkDeletedEvent
import com.ritense.processlink.event.ProcessLinksDeployedEvent
import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.processlink.mapper.PluginProcessLinkMapper
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.support.TransactionTemplate

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

    @AfterEach
    fun cleanup() {
        transactionTemplate.executeWithoutResult {
            configurationIssueRepository.deleteByCaseDefinitionId(CASE_DEFINITION_ID)
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

    companion object {
        private val CASE_DEFINITION_ID = CaseDefinitionId.of("recheck-issues-test", "1.0.0")
    }
}
