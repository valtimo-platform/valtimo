package com.ritense.zakenapi.listener

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.valtimo.contract.event.NoteCreatedEvent
import com.ritense.valtimo.contract.event.NoteUpdatedEvent
import com.ritense.valtimo.contract.event.NoteDeletedEvent
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Transactional
@Component
@SkipComponentScan
class NoteEventListener {

    @RunWithoutAuthorization
    @EventListener(NoteCreatedEvent::class)
    fun handleNoteCreatedEvent(event: NoteCreatedEvent) {
        logger.debug { "Note created event received: $event" }
    }

    @RunWithoutAuthorization
    @EventListener(NoteUpdatedEvent::class)
    fun handleNoteUpdatedEvent(event: NoteUpdatedEvent) {
        logger.debug { "Note updated event received: $event" }
    }

    @RunWithoutAuthorization
    @EventListener(NoteDeletedEvent::class)
    fun handleNoteUpdatedEvent(event: NoteDeletedEvent) {
        logger.debug { "Note deleted event received: $event" }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}