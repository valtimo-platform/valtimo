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

package com.ritense.zakenapi.listener

import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.contract.event.NoteCreatedEvent
import com.ritense.valtimo.contract.event.NoteDeletedEvent
import com.ritense.valtimo.contract.event.NoteUpdatedEvent
import com.ritense.zakenapi.service.ZaakNotitieService
import com.ritense.zakenapi.sync.CaseZakenApiSync
import com.ritense.zakenapi.sync.CaseZakenApiSyncManagementService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import java.util.UUID

internal class ZaakNotitieEventListenerTest {

    private val noteDocumentId = UUID.fromString("8f40482d-5598-48e0-9b26-c59e33e9ac0c")
    private val caseDefinitionId = CaseDefinitionId("house", "1.0.0")
    private val activeSyncConfig = CaseZakenApiSync(
        caseDefinitionId = caseDefinitionId,
        noteSyncEnabled = true,
        noteSubject = "Test subject",
    )

    private lateinit var zaakNotitieService: ZaakNotitieService
    private lateinit var caseZakenApiSyncManagementService: CaseZakenApiSyncManagementService
    private lateinit var documentService: DocumentService
    private lateinit var caseDocumentResolver: CaseDocumentResolver

    private lateinit var zaakNotitieEventListener: ZaakNotitieEventListener

    @BeforeEach
    fun setup() {
        zaakNotitieService = mock()
        caseZakenApiSyncManagementService = mock {
            on { getSyncConfiguration(eq(caseDefinitionId)) } doReturn activeSyncConfig
        }
        caseDocumentResolver = mock {
            on { resolveCaseDocumentId(eq(noteDocumentId)) } doReturn noteDocumentId
        }
        val definitionId = JsonSchemaDocumentDefinitionId.existingId("house", caseDefinitionId)
        val document = mock<Document> { on { definitionId() } doReturn definitionId }
        documentService = mock {
            on { get(eq(noteDocumentId.toString())) } doReturn document
        }

        zaakNotitieEventListener = ZaakNotitieEventListener(
            zaakNotitieService,
            caseZakenApiSyncManagementService,
            documentService,
            caseDocumentResolver,
        )
    }

    @Test
    fun `should create ZaakNotitie when note sync is enabled`() {
        zaakNotitieEventListener.handleNoteCreatedEvent(noteCreatedEvent())

        verify(zaakNotitieService).createZaakNotitieFrom(any(), eq("Test subject"))
    }

    @Test
    fun `should not create ZaakNotitie when note sync is disabled`() {
        whenever(caseZakenApiSyncManagementService.getSyncConfiguration(eq(caseDefinitionId)))
            .thenReturn(activeSyncConfig.copy(noteSyncEnabled = false))

        zaakNotitieEventListener.handleNoteCreatedEvent(noteCreatedEvent())

        verifyNoInteractions(zaakNotitieService)
    }

    @Test
    fun `should not create ZaakNotitie when no sync config exists for case definition`() {
        whenever(caseZakenApiSyncManagementService.getSyncConfiguration(eq(caseDefinitionId)))
            .thenReturn(null)

        zaakNotitieEventListener.handleNoteCreatedEvent(noteCreatedEvent())

        verifyNoInteractions(zaakNotitieService)
    }

    @Test
    fun `should update ZaakNotitie when note sync is enabled`() {
        zaakNotitieEventListener.handleNoteUpdatedEvent(noteUpdatedEvent())

        verify(zaakNotitieService).updateZaakNotitieFrom(any(), eq("Test subject"))
    }

    @Test
    fun `should not update ZaakNotitie when note sync is disabled`() {
        whenever(caseZakenApiSyncManagementService.getSyncConfiguration(eq(caseDefinitionId)))
            .thenReturn(activeSyncConfig.copy(noteSyncEnabled = false))

        zaakNotitieEventListener.handleNoteUpdatedEvent(noteUpdatedEvent())

        verifyNoInteractions(zaakNotitieService)
    }

    @Test
    fun `should delete ZaakNotitie when note sync is enabled`() {
        zaakNotitieEventListener.handleNoteDeletedEvent(noteDeletedEvent())

        verify(zaakNotitieService).deleteZaakNotitieFrom(any())
    }

    private fun noteCreatedEvent(): NoteCreatedEvent = mock {
        on { this.noteDocumentId } doReturn noteDocumentId
    }

    private fun noteUpdatedEvent(): NoteUpdatedEvent = mock {
        on { this.noteDocumentId } doReturn noteDocumentId
    }

    private fun noteDeletedEvent(): NoteDeletedEvent = mock {
        on { this.noteDocumentId } doReturn noteDocumentId
    }
}
