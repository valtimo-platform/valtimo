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

import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseDefinitionCreatedEvent
import com.ritense.valtimo.contract.event.CaseDefinitionPreDeleteEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class DocumentZakenApiSyncCaseEventListenerTest {

    private val service = mock<DocumentZakenApiSyncManagementService>()
    private val listener = DocumentZakenApiSyncCaseEventListener(service)

    private val sourceId = CaseDefinitionId("house", "1.0.0")
    private val targetId = CaseDefinitionId("house", "1.1.0")

    @Test
    fun `duplicates the sync config when a case definition is duplicated`() {
        whenever(service.getSyncConfiguration(eq(sourceId))).thenReturn(
            DocumentZakenApiSync(caseDefinitionId = sourceId, syncAssigneeAsBehandelaar = true)
        )

        listener.handleCaseDefinitionCreatedEvent(
            CaseDefinitionCreatedEvent(
                caseDefinitionId = targetId,
                duplicate = true,
                basedOnCaseDefinitionId = sourceId,
            )
        )

        val captor = argumentCaptor<DocumentZakenApiSync>()
        verify(service).saveSyncConfiguration(captor.capture())
        val saved = captor.firstValue
        assertThat(saved.caseDefinitionId).isEqualTo(targetId)
        assertThat(saved.syncAssigneeAsBehandelaar).isTrue()
    }

    @Test
    fun `does nothing when create event is not a duplicate`() {
        listener.handleCaseDefinitionCreatedEvent(
            CaseDefinitionCreatedEvent(caseDefinitionId = targetId, duplicate = false)
        )

        verify(service, never()).saveSyncConfiguration(any())
    }

    @Test
    fun `does nothing when source has no sync config`() {
        whenever(service.getSyncConfiguration(eq(sourceId))).thenReturn(null)

        listener.handleCaseDefinitionCreatedEvent(
            CaseDefinitionCreatedEvent(
                caseDefinitionId = targetId,
                duplicate = true,
                basedOnCaseDefinitionId = sourceId,
            )
        )

        verify(service, never()).saveSyncConfiguration(any())
    }

    @Test
    fun `deletes sync config when case definition is deleted`() {
        listener.handleCaseDefinitionPreDeleteEvent(CaseDefinitionPreDeleteEvent(targetId))

        verify(service).deleteSyncConfigurationByCaseDefinition(eq(targetId))
    }
}
