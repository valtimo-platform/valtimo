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

class DocumentZakenApiSyncManagementServiceTest {

    private val repository = mock<DocumentZakenApiSyncRepository>()
    private val caseDefinitionChecker = mock<CaseDefinitionChecker>()
    private val service = DocumentZakenApiSyncManagementService(repository, caseDefinitionChecker)

    private val caseDefinitionId = CaseDefinitionId("house", "1.0.0")

    @BeforeEach
    fun setUp() {
        whenever(repository.save(any<DocumentZakenApiSync>())).thenAnswer { it.arguments[0] }
    }

    @Test
    fun `getSyncConfiguration delegates to repository`() {
        val expected = DocumentZakenApiSync(caseDefinitionId = caseDefinitionId, syncAssigneeAsBehandelaar = true)
        whenever(repository.findByCaseDefinitionId(eq(caseDefinitionId))).thenReturn(expected)

        val actual = service.getSyncConfiguration(caseDefinitionId)

        assertThat(actual).isSameAs(expected)
    }

    @Test
    fun `saveSyncConfiguration creates a new record when none exists`() {
        val sync = DocumentZakenApiSync(caseDefinitionId = caseDefinitionId, syncAssigneeAsBehandelaar = true)
        whenever(repository.findByCaseDefinitionId(eq(caseDefinitionId))).thenReturn(null)

        service.saveSyncConfiguration(sync)

        verify(caseDefinitionChecker).assertCanUpdateCaseDefinitionConfiguration(
            eq(caseDefinitionId),
            eq(DocumentZakenApiSyncManagementService.ISSUE_TYPE),
        )
        verify(repository).save(eq(sync))
    }

    @Test
    fun `saveSyncConfiguration updates fields on the existing record`() {
        val existing = DocumentZakenApiSync(
            caseDefinitionId = caseDefinitionId,
            syncAssigneeAsBehandelaar = false,
            noteSyncEnabled = true,
            noteSubject = "old subject",
        )
        whenever(repository.findByCaseDefinitionId(eq(caseDefinitionId))).thenReturn(existing)

        val update = DocumentZakenApiSync(
            caseDefinitionId = caseDefinitionId,
            syncAssigneeAsBehandelaar = true,
            noteSyncEnabled = false,
            noteSubject = "new subject",
        )
        service.saveSyncConfiguration(update)

        val captor = argumentCaptor<DocumentZakenApiSync>()
        verify(repository).save(captor.capture())
        val saved = captor.firstValue
        assertThat(saved.id).isEqualTo(existing.id) // keeps the existing PK
        assertThat(saved.syncAssigneeAsBehandelaar).isTrue()
        assertThat(saved.noteSyncEnabled).isFalse()
        assertThat(saved.noteSubject).isEqualTo("new subject")
    }

    @Test
    fun `saveSyncConfiguration rejects records with no sync option enabled`() {
        val empty = DocumentZakenApiSync(
            caseDefinitionId = caseDefinitionId,
            syncAssigneeAsBehandelaar = false,
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
            eq(DocumentZakenApiSyncManagementService.ISSUE_TYPE),
        )
        verify(repository).deleteByCaseDefinitionId(eq(caseDefinitionId))
    }
}
