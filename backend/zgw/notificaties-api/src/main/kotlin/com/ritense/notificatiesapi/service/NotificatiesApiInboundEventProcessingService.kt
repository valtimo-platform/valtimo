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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import mu.KotlinLogging
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.io.PrintWriter
import java.io.StringWriter
import java.time.Duration
import java.time.LocalDateTime
import java.util.UUID
import kotlin.math.max
import kotlin.math.pow

@Service
@SkipComponentScan
class NotificatiesApiInboundEventProcessingService(
    private val inboundEventRepository: NotificatiesApiInboundEventRepository,
    private val applicationEventPublisher: ApplicationEventPublisher,
    private val objectMapper: ObjectMapper,
    private val processingProperties: NotificatiesApiProcessingProperties
) {

    @Transactional
    fun processBatch() {
        while (true) {
            val batch = inboundEventRepository.fetchNextBatchForProcessing(processingProperties.batchSize)
            if (batch.isEmpty()) {
                break
            }
            val now = LocalDateTime.now()
            batch.forEach { processSingleEvent(it, now) }
        }
        runMaintenance(LocalDateTime.now())
    }

    @Transactional
    fun processEvent(eventId: UUID) {
        val event = inboundEventRepository.findByIdForUpdate(eventId) ?: return
        val now = LocalDateTime.now()
        processSingleEvent(event, now)
    }

    private fun isEligibleForProcessing(event: NotificatiesApiInboundEvent, now: LocalDateTime): Boolean {
        return when (event.status) {
            NotificatiesApiInboundEventStatus.RECEIVED -> true
            NotificatiesApiInboundEventStatus.FAILED -> {
                val remainingRetries = event.pendingRetries ?: 0
                if (remainingRetries <= 0) {
                    return false
                }
                event.nextDueAt!! <= now
            }
            NotificatiesApiInboundEventStatus.PROCESSED -> false
        }
    }

    private fun nextRetryDelay(attemptsUsed: Int): Duration {
        val baseDelay = processingProperties.retryDelay
        if (baseDelay.isZero || baseDelay.isNegative) {
            return Duration.ZERO
        }
        val factorAttempts = max(attemptsUsed - 1, 0)
        val multiplier = processingProperties.retryBackoffMultiplier
        val factor = if (multiplier <= 1.0) {
            1.0
        } else {
            multiplier.pow(factorAttempts.toDouble())
        }
        val calculated = (baseDelay.toMillis().toDouble() * factor).toLong()
        val millis = max(calculated, baseDelay.toMillis())
        return Duration.ofMillis(millis)
    }

    private fun processSingleEvent(event: NotificatiesApiInboundEvent, now: LocalDateTime): Boolean {
        if (!isEligibleForProcessing(event, now)) {
            logger.trace { "Inbound event ${event.id} not yet eligible for retry" }
            return false
        }

        try {
            val notification: NotificatiesApiNotificationReceivedEvent = objectMapper.readValue(event.payload)
            applicationEventPublisher.publishEvent(notification)
            markProcessed(event, now)
            logger.debug { "Processed inbound event ${event.id}" }
        } catch (ex: Exception) {
            markFailed(event, now, ex)
            logger.warn(ex) { "Failed to process inbound event ${event.id}" }
        }
        inboundEventRepository.save(event)
        return true
    }

    private fun markProcessed(event: NotificatiesApiInboundEvent, now: LocalDateTime) {
        event.status = NotificatiesApiInboundEventStatus.PROCESSED
        event.lastProcessedAt = now
        event.pendingRetries = 0
        event.lastErrorMessage = null
        event.nextDueAt = null
    }

    private fun markFailed(event: NotificatiesApiInboundEvent, now: LocalDateTime, exception: Exception) {
        event.status = NotificatiesApiInboundEventStatus.FAILED
        event.lastProcessedAt = now
        event.lastErrorMessage = stackTrace(exception)
        val remaining = event.pendingRetries ?: processingProperties.initialRetries
        event.pendingRetries = max(remaining - 1, 0)
        if (event.pendingRetries == 0) {
            event.nextDueAt = null
        } else {
            val attemptsUsed = max(processingProperties.initialRetries - event.pendingRetries!!, 1)
            val delay = nextRetryDelay(attemptsUsed)
            event.nextDueAt = now.plus(delay)
        }
    }

    private fun stackTrace(exception: Exception): String {
        val writer = StringWriter()
        exception.printStackTrace(PrintWriter(writer))
        return writer.toString()
    }

    private fun runMaintenance(referenceTime: LocalDateTime) {
        cleanupProcessed(referenceTime)
        warnOnStuckReceived(referenceTime)
    }

    private fun cleanupProcessed(referenceTime: LocalDateTime) {
        val retention: Duration = processingProperties.retentionPeriod
        if (retention.isZero || retention.isNegative) {
            return
        }
        val cutoff = referenceTime.minus(retention)
        val removed = inboundEventRepository.deleteByStatusAndReceivedAtBefore(
            NotificatiesApiInboundEventStatus.PROCESSED,
            cutoff
        )
        if (removed > 0) {
            logger.debug { "Cleaned up $removed processed inbound events older than $cutoff" }
        }
    }

    private fun warnOnStuckReceived(referenceTime: LocalDateTime) {
        val threshold = processingProperties.receivedWarningThreshold
        if (threshold.isZero || threshold.isNegative) {
            return
        }
        val staleInstant = referenceTime.minus(threshold)
        val hasStuck = inboundEventRepository.existsByStatusAndReceivedAtBefore(
            NotificatiesApiInboundEventStatus.RECEIVED,
            staleInstant
        )
        if (hasStuck) {
            logger.error { "Inbound notificaties API events are stuck in RECEIVED for longer than $threshold" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
