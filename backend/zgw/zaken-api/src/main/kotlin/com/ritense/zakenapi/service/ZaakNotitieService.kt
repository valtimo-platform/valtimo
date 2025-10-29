package com.ritense.zakenapi.service

import com.ritense.valtimo.contract.event.NoteCreatedEvent
import com.ritense.valtimo.contract.event.NoteDeletedEvent
import com.ritense.valtimo.contract.event.NoteUpdatedEvent
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakNotitieLink
import com.ritense.zakenapi.domain.ZaakNotitieLinkId
import com.ritense.zakenapi.repository.ZaakNotitieLinkRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import java.util.UUID

class ZaakNotitieService(
    private val zaakUrlProvider: ZaakUrlProvider,
    private val zakenApiPlugin: ZakenApiPlugin,
    private val zaakNotitieLinkRepository: ZaakNotitieLinkRepository
) {

    fun createZaakNotitie(event: NoteCreatedEvent) {
        logger.debug { "Trying to create ZaakNotitie from NoteCreatedEvent for noteId: ${event.noteId}" }
        logger.trace { "Event: $event" }
        zaakUrlProvider.getZaakUrl(event.noteDocumentId).let { zaakUrl ->
            if (!zaakNotitieLinkRepository.existsByNoteId(event.noteId)) {
                zakenApiPlugin.createZaakNotitie(
                    onderwerp = "",
                    tekst = event.noteContent,
                    zaakUrl = zaakUrl,
                    aangemaaktDoor = event.noteCreatedByUserFullName
                ).let { zaakNotitie ->
                    zaakNotitieLinkRepository.save(ZaakNotitieLink(
                        zaakNotitieLinkId = ZaakNotitieLinkId.newId(UUID.randomUUID()),
                        zaakNotitieUrl = zaakNotitie.url,
                        noteId = event.noteId,
                        documentId = event.documentId
                    )).also {
                        logger.debug { "Created ZaakNotitieLink: $it" }
                    }
                }
            }
        }
    }

    fun updateZaakNotitie(event: NoteUpdatedEvent) {
        logger.debug { "Trying to patch ZaakNotitie from NoteUpdatedEvent for noteId: ${event.noteId}" }
        logger.trace { "Event: $event" }
        if (zaakNotitieLinkRepository.existsByNoteId(event.noteId)) {
            zaakNotitieLinkRepository.getByNoteId(event.noteId).let { zaakNotitieLink ->
                zakenApiPlugin.patchZaakNotitie(
                    zaakNotitieUrl = zaakNotitieLink.zaakNotitieUrl,
                    tekst = event.noteContent
                ).also {
                    logger.debug { "Patched ZaakNotitie: $it" }
                }
            }
        }
    }

    fun deleteZaakNotitie(event: NoteDeletedEvent) {
        logger.debug { "Trying to deleted ZaakNotitie from NoteDeletedEvent for noteId: ${event.noteId}" }
        logger.trace { "Event: $event" }
        if (zaakNotitieLinkRepository.existsByNoteId(event.noteId)) {
            zaakNotitieLinkRepository.getByNoteId(event.noteId).let { zaakNotitieLink ->
                zakenApiPlugin.deleteZaakNotitie(zaakNotitieUrl = zaakNotitieLink.zaakNotitieUrl).also {
                    logger.debug { "Deleted ZaakNotitie: $zaakNotitieLink" }
                }
                zaakNotitieLinkRepository.deleteById(zaakNotitieLink.id).also {
                    logger.debug { "Deleted ZaakNotitieLink: $zaakNotitieLink" }
                }
            }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}