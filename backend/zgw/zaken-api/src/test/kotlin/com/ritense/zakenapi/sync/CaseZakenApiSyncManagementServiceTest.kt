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

package com.ritense.zakenapi.sync

import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher

class CaseZakenApiSyncManagementServiceTest {

    private val repository = mock<CaseZakenApiSyncRepository>()
    private val caseDefinitionChecker = mock<CaseDefinitionChecker>()
    private val applicationEventPublisher = mock<ApplicationEventPublisher>()
    private val service = CaseZakenApiSyncManagementService(
        repository,
        caseDefinitionChecker,
        applicationEventPublisher,
    )

    private val caseDefinitionId = CaseDefinitionId("house", "1.0.0")

    @BeforeEach
    fun setUp() {
        whenever(repository.save(any<CaseZakenApiSync>())).thenAnswer { it.arguments[0] }
    }

    @Test
    fun `getSyncConfiguration delegates to repository`() {
        val expected = CaseZakenApiSync(caseDefinitionId = caseDefinitionId, assigneeSyncEnabled = true)
        whenever(repository.findByCaseDefinitionId(eq(caseDefinitionId))).thenReturn(expected)

        val actual = service.getSyncConfiguration(caseDefinitionId)

        assertThat(actual).isSameAs(expected)
    }

    @Test
    fun `saveSyncConfiguration creates a new record when none exists`() {
        val sync = CaseZakenApiSync(caseDefinitionId = caseDefinitionId, assigneeSyncEnabled = true)
        whenever(repository.findByCaseDefinitionId(eq(caseDefinitionId))).thenReturn(null)

        service.saveSyncConfiguration(sync)

        verify(caseDefinitionChecker).assertCanUpdateCaseDefinitionConfiguration(
            eq(caseDefinitionId),
            eq(CaseZakenApiSyncManagementService.ISSUE_TYPE),
        )
        verify(repository).save(eq(sync))
        verify(applicationEventPublisher).publishEvent(
            eq(
                CaseConfigurationIssueResolvedEvent(
                    caseDefinitionId,
                    CaseZakenApiSyncManagementService.ISSUE_TYPE,
                )
            )
        )
    }

    @Test
    fun `saveSyncConfiguration updates fields on the existing record`() {
        val existing = CaseZakenApiSync(
            caseDefinitionId = caseDefinitionId,
            assigneeSyncEnabled = false,
            noteSyncEnabled = true,
            noteSubject = "old subject",
        )
        whenever(repository.findByCaseDefinitionId(eq(caseDefinitionId))).thenReturn(existing)

        val update = CaseZakenApiSync(
            caseDefinitionId = caseDefinitionId,
            assigneeSyncEnabled = true,
            noteSyncEnabled = false,
            noteSubject = "new subject",
        )
        service.saveSyncConfiguration(update)

        val captor = argumentCaptor<CaseZakenApiSync>()
        verify(repository).save(captor.capture())
        val saved = captor.firstValue
        assertThat(saved.caseDefinitionId).isEqualTo(caseDefinitionId)
        assertThat(saved.assigneeSyncEnabled).isTrue()
        assertThat(saved.noteSyncEnabled).isFalse()
        assertThat(saved.noteSubject).isEqualTo("new subject")
    }

    @Test
    fun `saveSyncConfiguration rejects records with no sync option enabled`() {
        val empty = CaseZakenApiSync(
            caseDefinitionId = caseDefinitionId,
            assigneeSyncEnabled = false,
            noteSyncEnabled = false,
        )

        assertThatThrownBy { service.saveSyncConfiguration(empty) }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    @Test
    fun `delete delegates to repository`() {
        service.deleteSyncConfigurationByCaseDefinition(caseDefinitionId)

        verify(caseDefinitionChecker).assertCanUpdateCaseDefinitionConfiguration(
            eq(caseDefinitionId),
            eq(CaseZakenApiSyncManagementService.ISSUE_TYPE),
        )
        verify(repository).deleteByCaseDefinitionId(eq(caseDefinitionId))
    }
}
