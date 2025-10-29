package com.ritense.zakenapi.service

import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.event.NoteCreatedEvent
import com.ritense.valtimo.contract.event.NoteDeletedEvent
import com.ritense.valtimo.contract.event.NoteUpdatedEvent
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakNotitieLink
import com.ritense.zakenapi.domain.ZaakNotitieLinkId
import com.ritense.zakenapi.repository.ZaakNotitieLinkRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import java.net.URI
import java.util.UUID

class ZaakNotitieService(
    private val zaakUrlProvider: ZaakUrlProvider,
    private val pluginService: PluginService,
    private val zaakNotitieLinkRepository: ZaakNotitieLinkRepository
) {

    fun createZaakNotitie(event: NoteCreatedEvent) {
        logger.debug { "Trying to create ZaakNotitie from NoteCreatedEvent for noteId: ${event.noteId}" }
        logger.trace { "Event: $event" }
        zaakUrlProvider.getZaakUrl(event.noteDocumentId).let { zaakUrl ->
            if (!zaakNotitieLinkRepository.existsByNoteId(event.noteId)) {
                zakenApiPluginInstanceFor(zaakUrl)?.let { zakenApiPlugin ->
                    zakenApiPlugin.createZaakNotitie(
                        onderwerp = ZAAK_NOTITIE_ONDERWERP,
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
    }

    fun updateZaakNotitie(event: NoteUpdatedEvent) {
        logger.debug { "Trying to patch ZaakNotitie from NoteUpdatedEvent for noteId: ${event.noteId}" }
        logger.trace { "Event: $event" }
        if (zaakNotitieLinkRepository.existsByNoteId(event.noteId)) {
            zaakNotitieLinkRepository.getByNoteId(event.noteId).let { zaakNotitieLink ->
                zaakUrlProvider.getZaakUrl(event.noteDocumentId).let { zaakUrl ->
                    zakenApiPluginInstanceFor(zaakUrl)?.let { zakenApiPlugin ->
                        zakenApiPlugin.patchZaakNotitie(
                            zaakNotitieUrl = zaakNotitieLink.zaakNotitieUrl,
                            tekst = event.noteContent
                        ).also {
                            logger.debug { "Patched ZaakNotitie: $it" }
                        }
                    }
                }
            }
        }
    }

    fun deleteZaakNotitie(event: NoteDeletedEvent) {
        logger.debug { "Trying to deleted ZaakNotitie from NoteDeletedEvent for noteId: ${event.noteId}" }
        logger.trace { "Event: $event" }
        if (zaakNotitieLinkRepository.existsByNoteId(event.noteId)) {
            zaakNotitieLinkRepository.getByNoteId(event.noteId).let { zaakNotitieLink ->
                zaakUrlProvider.getZaakUrl(event.noteDocumentId).let { zaakUrl ->
                    zakenApiPluginInstanceFor(zaakUrl)?.let { zakenApiPlugin ->
                        zakenApiPlugin.deleteZaakNotitie(zaakNotitieUrl = zaakNotitieLink.zaakNotitieUrl).also {
                            logger.debug { "Deleted ZaakNotitie: $zaakNotitieLink" }
                        }
                        zaakNotitieLinkRepository.deleteById(zaakNotitieLink.id).also {
                            logger.debug { "Deleted ZaakNotitieLink: $zaakNotitieLink" }
                        }
                    }
                }
            }
        }
    }

    private fun zakenApiPluginInstanceFor(zaakUrl: URI): ZakenApiPlugin? = pluginService.createInstance(
        clazz = ZakenApiPlugin::class.java,
        configurationFilter = ZakenApiPlugin.findConfigurationByUrl(zaakUrl)
    ).also {
        if (it == null) {
            logger.warn {
                "Zaken API plugin has not been configured: unable to fulfill requested action!"
            }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}

        private const val ZAAK_NOTITIE_ONDERWERP = "Note synced from Valtimo GZAC"
    }
}