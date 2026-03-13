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

package com.ritense.case.listener

import com.ritense.case.domain.CaseDefinitionConfigurationIssue
import com.ritense.case.event.ConfigurationIssueUpdated
import com.ritense.case.repository.CaseDefinitionConfigurationIssueRepository
import com.ritense.outbox.OutboxService
import com.ritense.valtimo.contract.annotation.AllOpen
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssuesResetEvent
import com.ritense.valtimo.contract.event.CaseDefinitionPreDeleteEvent
import jakarta.transaction.Transactional
import org.springframework.context.event.EventListener
import java.time.LocalDateTime

@Transactional
@AllOpen
open class CaseDefinitionConfigurationIssueListener(
    private val repository: CaseDefinitionConfigurationIssueRepository,
    private val outboxService: OutboxService
) {

    @EventListener(CaseConfigurationIssueDetectedEvent::class)
    fun handleIssueDetected(event: CaseConfigurationIssueDetectedEvent) {
        val existing = repository.findUnresolvedByCaseDefinitionIdAndIssueType(
            event.caseDefinitionId, event.issueType
        )
        if (existing == null) {
            repository.save(
                CaseDefinitionConfigurationIssue(
                    caseDefinitionId = event.caseDefinitionId,
                    issueType = event.issueType
                )
            )
            outboxService.send {
                ConfigurationIssueUpdated(
                    caseDefinitionKey = event.caseDefinitionId.key,
                    caseDefinitionVersionTag = event.caseDefinitionId.versionTag.toString()
                )
            }
        }
    }

    @EventListener(CaseConfigurationIssueResolvedEvent::class)
    fun handleIssueResolved(event: CaseConfigurationIssueResolvedEvent) {
        val existing = repository.findUnresolvedByCaseDefinitionIdAndIssueType(
            event.caseDefinitionId, event.issueType
        ) ?: return
        repository.save(existing.copy(resolved = true, resolvedAt = LocalDateTime.now()))
        outboxService.send {
            ConfigurationIssueUpdated(
                caseDefinitionKey = event.caseDefinitionId.key,
                caseDefinitionVersionTag = event.caseDefinitionId.versionTag.toString()
            )
        }
    }

    @EventListener(CaseConfigurationIssuesResetEvent::class)
    fun handleIssuesReset(event: CaseConfigurationIssuesResetEvent) {
        repository.deleteByCaseDefinitionId(event.caseDefinitionId)
        outboxService.send {
            ConfigurationIssueUpdated(
                caseDefinitionKey = event.caseDefinitionId.key,
                caseDefinitionVersionTag = event.caseDefinitionId.versionTag.toString()
            )
        }
    }

    @EventListener(CaseDefinitionPreDeleteEvent::class)
    fun handleCaseDefinitionPreDelete(event: CaseDefinitionPreDeleteEvent) {
        repository.deleteByCaseDefinitionId(event.caseDefinitionId)
    }
}
