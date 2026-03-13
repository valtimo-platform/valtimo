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
import com.ritense.case.repository.CaseDefinitionConfigurationIssueRepository
import com.ritense.outbox.OutboxService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssuesResetEvent
import com.ritense.valtimo.contract.event.CaseDefinitionPreDeleteEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class CaseDefinitionConfigurationIssueListenerTest {

    lateinit var repository: CaseDefinitionConfigurationIssueRepository
    lateinit var outboxService: OutboxService
    lateinit var listener: CaseDefinitionConfigurationIssueListener

    private val caseDefinitionId = CaseDefinitionId("test-case", "1.0.0")
    private val issueType = "test-issue-type"

    @BeforeEach
    fun setUp() {
        repository = mock()
        outboxService = mock()
        listener = CaseDefinitionConfigurationIssueListener(repository, outboxService)
    }

    @Test
    fun `handleIssueDetected should save new issue and send outbox event when no existing unresolved issue`() {
        whenever(repository.findUnresolvedByCaseDefinitionIdAndIssueType(caseDefinitionId, issueType))
            .thenReturn(null)
        whenever(repository.save(any<CaseDefinitionConfigurationIssue>())).thenAnswer { it.getArgument(0) }

        listener.handleIssueDetected(CaseConfigurationIssueDetectedEvent(caseDefinitionId, issueType))

        val captor = argumentCaptor<CaseDefinitionConfigurationIssue>()
        verify(repository).save(captor.capture())
        assertThat(captor.firstValue.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(captor.firstValue.issueType).isEqualTo(issueType)
        assertThat(captor.firstValue.resolved).isFalse()
        verify(outboxService).send(any())
    }

    @Test
    fun `handleIssueDetected should not save when unresolved issue already exists`() {
        val existing = CaseDefinitionConfigurationIssue(
            caseDefinitionId = caseDefinitionId,
            issueType = issueType
        )
        whenever(repository.findUnresolvedByCaseDefinitionIdAndIssueType(caseDefinitionId, issueType))
            .thenReturn(existing)

        listener.handleIssueDetected(CaseConfigurationIssueDetectedEvent(caseDefinitionId, issueType))

        verify(repository, never()).save(any())
        verify(outboxService, never()).send(any())
    }

    @Test
    fun `handleIssueResolved should mark existing issue as resolved and send outbox event`() {
        val existing = CaseDefinitionConfigurationIssue(
            caseDefinitionId = caseDefinitionId,
            issueType = issueType,
            resolved = false
        )
        whenever(repository.findUnresolvedByCaseDefinitionIdAndIssueType(caseDefinitionId, issueType))
            .thenReturn(existing)
        whenever(repository.save(any<CaseDefinitionConfigurationIssue>())).thenAnswer { it.getArgument(0) }

        listener.handleIssueResolved(CaseConfigurationIssueResolvedEvent(caseDefinitionId, issueType))

        val captor = argumentCaptor<CaseDefinitionConfigurationIssue>()
        verify(repository).save(captor.capture())
        assertThat(captor.firstValue.resolved).isTrue()
        assertThat(captor.firstValue.resolvedAt).isNotNull()
        verify(outboxService).send(any())
    }

    @Test
    fun `handleIssueResolved should return early when no existing unresolved issue`() {
        whenever(repository.findUnresolvedByCaseDefinitionIdAndIssueType(caseDefinitionId, issueType))
            .thenReturn(null)

        listener.handleIssueResolved(CaseConfigurationIssueResolvedEvent(caseDefinitionId, issueType))

        verify(repository, never()).save(any())
        verify(outboxService, never()).send(any())
    }

    @Test
    fun `handleIssuesReset should delete all issues and send outbox event`() {
        listener.handleIssuesReset(CaseConfigurationIssuesResetEvent(caseDefinitionId))

        verify(repository).deleteByCaseDefinitionId(caseDefinitionId)
        verify(outboxService).send(any())
    }

    @Test
    fun `handleCaseDefinitionPreDelete should delete all issues for case definition`() {
        listener.handleCaseDefinitionPreDelete(CaseDefinitionPreDeleteEvent(caseDefinitionId))

        verify(repository).deleteByCaseDefinitionId(caseDefinitionId)
    }
}
