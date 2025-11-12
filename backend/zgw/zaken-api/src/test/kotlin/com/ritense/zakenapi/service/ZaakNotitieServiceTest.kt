package com.ritense.zakenapi.service

import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.event.NoteCreatedEvent
import com.ritense.valtimo.contract.event.NoteDeletedEvent
import com.ritense.valtimo.contract.event.NoteUpdatedEvent
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakNotitie
import com.ritense.zakenapi.domain.ZaakNotitieLink
import com.ritense.zakenapi.domain.ZaakNotitieLinkId
import com.ritense.zakenapi.repository.ZaakNotitieLinkRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.Before
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import java.net.URI
import java.time.LocalDateTime
import java.util.UUID

internal class ZaakNotitieServiceTest {

    private lateinit var zakenApiPlugin: ZakenApiPlugin
    private lateinit var zaakUrlProvider: ZaakUrlProvider
    private lateinit var pluginService: PluginService
    private lateinit var zaakNotitieLinkRepository: ZaakNotitieLinkRepository

    private lateinit var zaakNotitieService: ZaakNotitieService

    @Before
    fun setup() {
        zakenApiPlugin = mock {
            on { this.noteSubject } doReturn noteSubject()
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
        zaakNotitieLinkRepository = mock()

        zaakNotitieService = ZaakNotitieService(zaakUrlProvider, pluginService, zaakNotitieLinkRepository)
    }

    @Test
    fun `should create ZaakNotitie`() {
        // given
        val event = noteCreatedEvent()

        whenever(
            zakenApiPlugin.createZaakNotitie(
                onderwerp = any(),
                tekst = any(),
                zaakUrl = any(),
                aangemaaktDoor = any(),
                notitieType = anyOrNull(),
                status = anyOrNull()
            )
        ).thenReturn(zaakNotitie(tekst = event.noteContent!!))

        whenever(zaakNotitieLinkRepository.existsByNoteId(event.noteId))
            .thenReturn(false)

        // when
        zaakNotitieService.createZaakNotitieFrom(event)

        // then
        verify(zakenApiPlugin).createZaakNotitie(
            onderwerp = any(),
            tekst = eq(event.noteContent!!),
            zaakUrl = eq(zaakUrl()),
            aangemaaktDoor = eq(event.noteCreatedByUserFullName),
            notitieType = eq(null),
            status = eq(null)
        )
        argumentCaptor<ZaakNotitieLink> {
            verify(zaakNotitieLinkRepository).save(capture())

            assertThat(firstValue.noteId).isEqualTo(noteId())
            assertThat(firstValue.documentId).isEqualTo(documentId())
            assertThat(firstValue.zaakNotitieUrl).isEqualTo(zaakNotitieUrl())
        }
    }

    @Test
    fun `should not create ZaakNotitie when ZaakNotitieLink already exist`() {
        val event = noteCreatedEvent()

        whenever(zaakNotitieLinkRepository.existsByNoteId(event.noteId))
            .thenReturn(true)

        zaakNotitieService.createZaakNotitieFrom(event)

        verifyNoInteractions(pluginService)
        verify(zaakNotitieLinkRepository, never()).save(any())
    }

    @Test
    fun `should update ZaakNotitie`() {
        val event = noteUpdatedEvent()
        val zaakNotitieLink = zaakNotitieLink()

        whenever(
            zakenApiPlugin.updateZaakNotitie(
                zaakNotitieUrl = any(),
                onderwerp = any(),
                tekst = any(),
                zaakUrl = any(),
                aangemaaktDoor = any(),
                notitieType = anyOrNull(),
                status = anyOrNull()
            )
        ).thenReturn(zaakNotitie(tekst = event.noteContent!!))

        whenever(zaakNotitieLinkRepository.existsByNoteId(event.noteId))
            .thenReturn(true)

        whenever(zaakNotitieLinkRepository.getByNoteId(event.noteId))
            .thenReturn(zaakNotitieLink)

        // when
        zaakNotitieService.updateZaakNotitieFrom(event)

        // then
        verify(zakenApiPlugin).updateZaakNotitie(
            zaakNotitieUrl = eq(zaakNotitieLink.zaakNotitieUrl),
            onderwerp = any(),
            tekst = eq(event.noteContent!!),
            zaakUrl = eq(zaakUrl()),
            aangemaaktDoor = eq(null),
            notitieType = eq(null),
            status = eq(null)
        )
        verify(zaakNotitieLinkRepository, never()).save(any())
    }

    @Test
    fun `should not update ZaakNotitie when ZaakNotitieLink does not exist`() {
        val event = noteUpdatedEvent()

        whenever(zaakNotitieLinkRepository.existsByNoteId(event.noteId))
            .thenReturn(false)

        // when
        zaakNotitieService.updateZaakNotitieFrom(event)

        // then
        verifyNoInteractions(pluginService)
    }

    @Test
    fun `should delete ZaakNotitie`() {
        // given
        val event = noteDeletedEvent()
        val zaakNotitieLink = zaakNotitieLink()

        whenever(zaakNotitieLinkRepository.existsByNoteId(event.noteId))
            .thenReturn(true)

        whenever(zaakNotitieLinkRepository.getByNoteId(event.noteId))
            .thenReturn(zaakNotitieLink)

        // when
        zaakNotitieService.deleteZaakNotitieFrom(event)

        // then
        verify(zakenApiPlugin).deleteZaakNotitie(eq(zaakNotitieLink.zaakNotitieUrl))
        verify(zaakNotitieLinkRepository).deleteById(eq(zaakNotitieLink.id))
    }

    @Test
    fun `should not delete ZaakNotitie when ZaakNotitieLink does not exist`() {
        // given
        val event = noteDeletedEvent()

        whenever(zaakNotitieLinkRepository.existsByNoteId(event.noteId))
            .thenReturn(false)

        // when
        zaakNotitieService.deleteZaakNotitieFrom(event)

        // then
        verifyNoInteractions(pluginService)
    }

    private fun documentId() = UUID.fromString("8f40482d-5598-48e0-9b26-c59e33e9ac0c")
    private fun zaakUrl() = URI.create("https://zakenapi.com/zaken/a03bdcec-fbff-4856-852b-0a089ae9e2af")
    private fun noteId() = UUID.fromString("b5e6b55e-aa53-4a10-9dea-a1c8e4099d49")
    private fun zaakNotitieId() = UUID.fromString("8be448d9-a117-4b88-89b7-3aaf48ff7947")
    private fun zaakNotitieUrl() = URI.create("https://zakenapi.com/zaaknotities/e6a64f77-00ef-41dc-a24a-16573776c298")
    private fun createdByUserId() = "john.doe"
    private fun createdByUserFullName() = "John Doe"
    private fun noteSubject() = "Note create by Valtimo GZAC"

    private fun zaakNotitie(
        tekst: String = "Content",
    ) = ZaakNotitie(
        url = zaakNotitieUrl(),
        onderwerp = noteSubject(),
        tekst = tekst,
        aangemaaktDoor = createdByUserFullName(),
        aanmaakdatum = LocalDateTime.now(),
        wijzigingsdatum = LocalDateTime.now(),
        gerelateerdAan = zaakUrl()
    )

    private fun zaakNotitieLink(existing: Boolean = true) = ZaakNotitieLink(
        zaakNotitieLinkId = if (existing) {
            ZaakNotitieLinkId.existingId(zaakNotitieId())
        } else {
            ZaakNotitieLinkId.newId(zaakNotitieId())
        },
        zaakNotitieUrl = zaakNotitieUrl(),
        noteId = noteId(),
        documentId = documentId()
    )

    private fun noteCreatedEvent(
        content: String = "Content"
    ) = NoteCreatedEvent(
        noteId = noteId(),
        noteDocumentId = documentId(),
        noteContent = content,
        noteCreatedByUserId = createdByUserId(),
        noteCreatedByUserFullName = createdByUserFullName(),
        noteCreatedOn = LocalDateTime.now()
    )

    private fun noteUpdatedEvent(
        content: String = "Updated content"
    ) = NoteUpdatedEvent(
        noteId = noteId(),
        noteDocumentId = documentId(),
        noteContent = content,
    )

    private fun noteDeletedEvent() = NoteDeletedEvent(
        noteId = noteId(),
        noteDocumentId = documentId()
    )
}