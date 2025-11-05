package com.ritense.zakenapi.listener

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.event.NoteCreatedEvent
import com.ritense.valtimo.contract.event.NoteUpdatedEvent
import com.ritense.valtimo.contract.event.NoteDeletedEvent
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.service.ZaakNotitieService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
@Component
@SkipComponentScan
class ZaakNotitieEventListener(
    private val zaakUrlProvider: ZaakUrlProvider,
    private val pluginService: PluginService,
    private val zaakNotitieService: ZaakNotitieService
) {

    @RunWithoutAuthorization
    @EventListener(NoteCreatedEvent::class)
    fun handleNoteCreatedEvent(event: NoteCreatedEvent) {
        logger.debug { "Note created event received: $event" }
        if (noteEventListenerEnabled(event.noteDocumentId)) {
            zaakNotitieService.createZaakNotitieFrom(event)
        }
    }

    @RunWithoutAuthorization
    @EventListener(NoteUpdatedEvent::class)
    fun handleNoteUpdatedEvent(event: NoteUpdatedEvent) {
        logger.debug { "Note updated event received: $event" }
        if (noteEventListenerEnabled(event.noteDocumentId)) {
            zaakNotitieService.updateZaakNotitieFrom(event)
        }
    }

    @RunWithoutAuthorization
    @EventListener(NoteDeletedEvent::class)
    fun handleNoteDeletedEvent(event: NoteDeletedEvent) {
        logger.debug { "Note deleted event received: $event" }
        if (noteEventListenerEnabled(event.noteDocumentId)) {
            zaakNotitieService.deleteZaakNotitieFrom(event)
        }
    }

    private fun noteEventListenerEnabled(documentId: UUID): Boolean =
        (zakenApiPluginInstanceFrom(documentId)?.noteEventListenerEnabled ?: false).also { enabled ->
            if (!enabled) {
                logger.debug { "> Ignoring event as note event listener is disabled in Zaken API plugin configuration" }
            }
        }

    private fun zakenApiPluginInstanceFrom(documentId: UUID): ZakenApiPlugin? =
        zaakUrlProvider.getZaakUrl(documentId).let { zaakUrl ->
            pluginService.createInstance(
                clazz = ZakenApiPlugin::class.java,
                configurationFilter = ZakenApiPlugin.findConfigurationByUrl(zaakUrl)
            ).also {
                if (it == null) {
                    logger.warn { "Zaken API plugin has not been configured: Unable to fulfill requested action!" }
                }
            }
        }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}