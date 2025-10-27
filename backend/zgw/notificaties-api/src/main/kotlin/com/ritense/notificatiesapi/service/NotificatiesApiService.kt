/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.notificatiesapi.service

import com.ritense.notificatiesapi.domain.NotificatiesApiAbonnementLink
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.exception.AuthorizationException
import com.ritense.notificatiesapi.repository.NotificatiesApiAbonnementLinkRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import mu.KotlinLogging
import org.springframework.core.task.TaskExecutor
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.util.UUID
import java.util.concurrent.RejectedExecutionException

@Service
@SkipComponentScan
class NotificatiesApiService(
    private val notificatiesApiAbonnementLinkRepository: NotificatiesApiAbonnementLinkRepository,
    private val inboundEventIntakeService: NotificatiesApiInboundEventIntakeService,
    private val inboundEventProcessingService: NotificatiesApiInboundEventProcessingService,
    private val taskExecutor: TaskExecutor
) {

    fun registerNotification(notification: NotificatiesApiNotificationReceivedEvent): Boolean {
        logger.debug { "Notification received: $notification" }
        val eventId = inboundEventIntakeService.registerInboundNotification(notification)
        if (eventId != null) {
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
                    override fun afterCommit() {
                        submitForProcessing(eventId)
                    }
                })
            } else {
                submitForProcessing(eventId)
            }
        }
        return eventId != null
    }

    private fun submitForProcessing(eventId: UUID) {
        try {
            taskExecutor.execute {
                inboundEventProcessingService.processEvent(eventId)
            }
        } catch (ex: RejectedExecutionException) {
            logger.warn(ex) { "Processing queue full, deferring inbound event $eventId to scheduled worker" }
        }
    }

    @Transactional(readOnly = true)
    fun findAbonnementSubscription(authHeader: String): NotificatiesApiAbonnementLink {
        return notificatiesApiAbonnementLinkRepository.findByAuth(authHeader)
            ?: throw AuthorizationException()
    }

    companion object {
        val logger = KotlinLogging.logger {}
    }
}
