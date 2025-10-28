package com.ritense.gzac.notifications

import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

@Component
class TestEventListener {

    @EventListener(NotificatiesApiNotificationReceivedEvent::class)
    fun handleTestEvent(event: NotificatiesApiNotificationReceivedEvent) {
        if (event.kenmerken.contains("test-success")) {
            val exceptedResult = event.kenmerken.get("test-success")

            if (exceptedResult == "true") {
                logger.info { "Test event processed successfully: $event" }
            } else {
                logger.info { "Test event failed to process: $event" }
                throw RuntimeException("Failing test event: $event")
            }

        } else {
            // event is not a test event, ignore
        }
    }

    companion object {
        private val logger = mu.KotlinLogging.logger {}
    }
}