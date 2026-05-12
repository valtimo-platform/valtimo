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
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import java.util.UUID

@Transactional
class ZaakNotitieService(
    private val zaakUrlProvider: ZaakUrlProvider,
    private val pluginService: PluginService,
    private val zaakNotitieLinkRepository: ZaakNotitieLinkRepository
) {

    fun createZaakNotitieFrom(event: NoteCreatedEvent, noteSubject: String) {
        logger.info {
            "Trying to create ZaakNotitie from NoteCreatedEvent for " +
                "Note(id=${event.noteId}, documentId=${event.noteDocumentId})"
        }
        logger.trace { "Event: $event" }
        zaakUrlProvider.getZaakUrl(event.noteDocumentId!!).let { zaakUrl ->
            if (!zaakNotitieLinkRepository.existsByNoteId(event.noteId)) {
                zakenApiPluginInstanceFor(zaakUrl)?.let { zakenApiPlugin ->
                    zakenApiPlugin.createZaakNotitie(
                        onderwerp = noteSubject,
                        tekst = event.noteContent!!,
                        zaakUrl = zaakUrl,
                        aangemaaktDoor = event.noteCreatedByUserFullName
                    ).let { zaakNotitie ->
                        zaakNotitieLinkRepository.save(ZaakNotitieLink(
                            zaakNotitieLinkId = ZaakNotitieLinkId.newId(UUID.randomUUID()),
                            zaakNotitieUrl = zaakNotitie.url,
                            noteId = event.noteId,
                            documentId = event.noteDocumentId
                        )).also {
                            logger.debug { "Created ZaakNotitieLink for " +
                                "zaakNotitieUrl: ${it.zaakNotitieUrl} and"
                                "noteId: ${it.noteId} and " +
                                "documentId: ${it.documentId}"
                            }
                        }
                        logger.info { "Created ZaakNotitie(url=${zaakNotitie.url})" }
                    }
                }
            } else {
                logger.info { "> Skipped as ZaakNotitieLink already exists" }
            }
        }
    }

    fun updateZaakNotitieFrom(event: NoteUpdatedEvent, noteSubject: String) {
        logger.info {
            "Trying to update ZaakNotitie from NoteUpdatedEvent for " +
                "Note(id=${event.noteId}, documentId=${event.noteDocumentId})"
        }
        logger.trace { "Event: $event" }
        if (zaakNotitieLinkRepository.existsByNoteId(event.noteId)) {
            zaakNotitieLinkRepository.getByNoteId(event.noteId).let { zaakNotitieLink ->
                zaakUrlProvider.getZaakUrl(event.noteDocumentId!!).let { zaakUrl ->
                    zakenApiPluginInstanceFor(zaakUrl)?.let { zakenApiPlugin ->
                        zakenApiPlugin.updateZaakNotitie(
                            zaakNotitieUrl = zaakNotitieLink.zaakNotitieUrl,
                            onderwerp = noteSubject,
                            tekst = event.noteContent!!,
                            zaakUrl = zaakUrl
                        ).also {
                            logger.info { "Updated ZaakNotitie(url=${it.url})" }
                        }
                    }
                }
            }
        } else {
            logger.info { "> Skipped as no ZaakNotitieLink exists" }
        }
    }

    fun deleteZaakNotitieFrom(event: NoteDeletedEvent) {
        logger.info {
            "Trying to delete ZaakNotitie from NoteDeletedEvent for " +
                "Note(id=${event.noteId}, documentId=${event.noteDocumentId})"
        }
        logger.trace { "Event: $event" }
        if (zaakNotitieLinkRepository.existsByNoteId(event.noteId)) {
            zaakNotitieLinkRepository.getByNoteId(event.noteId).let { zaakNotitieLink ->
                zakenApiPluginInstanceFor(event.noteDocumentId!!)?.let { zakenApiPlugin ->
                    zakenApiPlugin.deleteZaakNotitie(zaakNotitieUrl = zaakNotitieLink.zaakNotitieUrl)
                    zaakNotitieLinkRepository.deleteById(zaakNotitieLink.id).also {
                        logger.debug { "Deleted ZaakNotitieLink for " +
                            "zaakNotitieUrl: ${zaakNotitieLink.zaakNotitieUrl} and"
                            "noteId: ${zaakNotitieLink.noteId} and " +
                            "documentId: ${zaakNotitieLink.documentId}"
                        }
                    }
                    logger.info {
                        "Deleted ZaakNotitie(url=${zaakNotitieLink.zaakNotitieUrl})"
                    }
                }
            }
        } else {
            logger.info { "> Skipped as no ZaakNotitieLink exists" }
        }
    }

    private fun zakenApiPluginInstanceFor(documentId: UUID): ZakenApiPlugin? =
        zakenApiPluginInstanceFor(zaakUrlProvider.getZaakUrl(documentId))

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
    }
}