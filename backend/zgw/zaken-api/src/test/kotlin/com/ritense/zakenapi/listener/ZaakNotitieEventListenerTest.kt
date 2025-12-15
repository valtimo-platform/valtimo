/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.event.NoteCreatedEvent
import com.ritense.valtimo.contract.event.NoteDeletedEvent
import com.ritense.valtimo.contract.event.NoteUpdatedEvent
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.service.ZaakNotitieService
import org.junit.Before
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import java.net.URI
import java.util.UUID

internal class ZaakNotitieEventListenerTest {

    private lateinit var zakenApiPlugin: ZakenApiPlugin
    private lateinit var zaakUrlProvider: ZaakUrlProvider
    private lateinit var pluginService: PluginService
    private lateinit var zaakNotitieService: ZaakNotitieService

    private lateinit var zaakNotitieEventListener: ZaakNotitieEventListener

    @Before
    fun setup() {
        zakenApiPlugin = mock {
            on { noteEventListenerEnabled } doReturn true
        }
        zaakUrlProvider = mock {
            on { getZaakUrl(eq(documentId())) } doReturn zaakUrl()
        }
        pluginService = mock {
            on {
                createInstance(
                    clazz = eq(ZakenApiPlugin::class.java),
                    configurationFilter = any()
                )
            } doReturn zakenApiPlugin
        }
        zaakNotitieService = mock()

        zaakNotitieEventListener = ZaakNotitieEventListener(zaakUrlProvider, pluginService, zaakNotitieService)
    }

    @Test
    fun `should handle NoteCreatedEvent and trigger create ZaakNotitie when plugin property noteEventListenerEnabled is true`() {
        // when
        zaakNotitieEventListener.handleNoteCreatedEvent(noteCreatedEvent())

        // then
        verify(zaakNotitieService).createZaakNotitieFrom(any())
    }

    @Test
    fun `should handle NoteCreatedEvent and not trigger create ZaakNotitie when plugin property noteEventListenerEnabled is false`() {
        // given
        whenever(zakenApiPlugin.noteEventListenerEnabled)
            .thenReturn(false)

        // when
        zaakNotitieEventListener.handleNoteCreatedEvent(noteCreatedEvent())

        // then
        verifyNoInteractions(zaakNotitieService)
    }

    @Test
    fun `should handle NoteCreatedUpdated and trigger update ZaakNotitie when plugin property noteEventListenerEnabled is true`() {
        // when
        zaakNotitieEventListener.handleNoteUpdatedEvent(noteUpdatedEvent())

        // then
        verify(zaakNotitieService).updateZaakNotitieFrom(any())
    }

    @Test
    fun `should handle NoteCreatedUpdated and not trigger update ZaakNotitie when plugin property noteEventListenerEnabled is false`() {
        // given
        whenever(zakenApiPlugin.noteEventListenerEnabled)
            .thenReturn(false)

        // when
        zaakNotitieEventListener.handleNoteUpdatedEvent(noteUpdatedEvent())

        // then
        verifyNoInteractions(zaakNotitieService)
    }

    @Test
    fun `should handle NoteCreatedDeleted and trigger delete ZaakNotitie when plugin property noteEventListenerEnabled is true`() {
        // when
        zaakNotitieEventListener.handleNoteDeletedEvent(noteDeletedEvent())

        // then
        verify(zaakNotitieService).deleteZaakNotitieFrom(any())
    }

    @Test
    fun `should handle NoteCreatedDeleted and not trigger delete ZaakNotitie when plugin property noteEventListenerEnabled is false`() {
        // given
        whenever(zakenApiPlugin.noteEventListenerEnabled)
            .thenReturn(false)

        // when
        zaakNotitieEventListener.handleNoteDeletedEvent(noteDeletedEvent())

        // then
        verifyNoInteractions(zaakNotitieService)
    }

    private fun documentId() = UUID.fromString("8f40482d-5598-48e0-9b26-c59e33e9ac0c")
    private fun zaakUrl() = URI.create("https://zakenapi.com/zaken/a03bdcec-fbff-4856-852b-0a089ae9e2af")

    private fun noteCreatedEvent(): NoteCreatedEvent = mock {
        on { this.noteDocumentId } doReturn documentId()
    }

    private fun noteUpdatedEvent(): NoteUpdatedEvent = mock {
        on { this.noteDocumentId } doReturn documentId()
    }

    private fun noteDeletedEvent(): NoteDeletedEvent = mock {
        on { this.noteDocumentId } doReturn documentId()
    }
}