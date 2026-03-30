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

package com.ritense.outbox.publisher

import com.ritense.outbox.OutboxMessage
import com.ritense.outbox.ValtimoOutboxService
import io.github.oshai.kotlinlogging.KotlinLogging
import io.github.resilience4j.circuitbreaker.CircuitBreaker
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

open class PollingPublisherService(
    private val outboxService: ValtimoOutboxService,
    private val messagePublisher: MessagePublisher,
    private val platformTransactionManager: PlatformTransactionManager,
    private val batchSize: Int = DEFAULT_BATCH_SIZE,
    private val circuitBreaker: CircuitBreaker? = null
) {
    // Prevents concurrent polling from multiple scheduled invocations
    private val polling = AtomicBoolean(false)

    // Backwards-compatible constructor for existing callers
    constructor(
        outboxService: ValtimoOutboxService,
        messagePublisher: MessagePublisher,
        platformTransactionManager: PlatformTransactionManager
    ) : this(outboxService, messagePublisher, platformTransactionManager, DEFAULT_BATCH_SIZE, null)

    init {
        logger.info { "Using ${messagePublisher::class.qualifiedName} as outbox message publisher." }
        if (circuitBreaker != null) {
            logger.info { "Outbox circuit breaker enabled: ${circuitBreaker.name}" }
        }
    }

    /**
     * Polls messages from the outbox table and publishes them in batches.
     *
     * The method processes batches in a loop until no more messages are available.
     * Each batch is fetched and published within a single transaction to ensure
     * the FOR UPDATE SKIP LOCKED row locks are held during publishing.
     *
     * Circuit breaker behavior:
     * - OPEN: skips polling entirely, no database access
     * - HALF_OPEN: fetches 1 message at a time to test if the publisher has recovered
     * - CLOSED: normal batch processing
     */
    open fun pollAndPublishAll() {
        if (isCircuitBreakerOpen()) {
            logger.debug { "Circuit breaker is OPEN. Skipping outbox polling." }
            return
        }

        if (polling.compareAndSet(false, true)) {
            try {
                do {
                    val continuePolling = TransactionTemplate(platformTransactionManager).execute {
                        // Use batch size of 1 during HALF_OPEN to limit exposure while testing recovery
                        val effectiveBatchSize = if (isCircuitBreakerHalfOpen()) 1 else batchSize
                        val messages = outboxService.getOldestMessages(effectiveBatchSize)
                        if (messages.isNotEmpty()) {
                            publishAndDeleteBatch(messages)
                        } else {
                            false
                        }
                    } ?: false

                    // Stop if the batch indicated no more work, or if the circuit breaker opened mid-loop
                    if (!continuePolling || isCircuitBreakerOpen()) {
                        polling.set(false)
                    }
                } while (polling.get())
            } catch (e: Exception) {
                throw RuntimeException("Failed to poll and publish outbox messages", e)
            } finally {
                polling.set(false)
            }
        }
    }

    /**
     * Publishes a batch of messages and deletes the successful ones.
     *
     * @return true if there may be more messages to process (batch was full), false otherwise
     */
    private fun publishAndDeleteBatch(messages: List<OutboxMessage>): Boolean {
        logger.debug { "Publishing batch of ${messages.size} outbox message(s)" }

        val startTime = System.nanoTime()
        val results = messagePublisher.publishBatch(messages)
        val durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTime)

        // Record each result individually on the circuit breaker for fine-grained failure tracking.
        // We use manual recording (onSuccess/onError) instead of executeSupplier because the default
        // publishBatch implementation catches exceptions per message and never throws itself.
        results.forEach { result ->
            if (circuitBreaker != null) {
                if (result.success) {
                    circuitBreaker.onSuccess(0, TimeUnit.NANOSECONDS)
                } else {
                    circuitBreaker.onError(
                        0, TimeUnit.NANOSECONDS,
                        result.error ?: MessagePublishingFailed("Failed to publish outbox message ${result.messageId}")
                    )
                }
            }
        }

        val successIds = results.filter { it.success }.map { it.messageId }
        val failures = results.filter { !it.success }

        // Only delete successfully published messages; failed ones stay in the outbox for retry
        if (successIds.isNotEmpty()) {
            outboxService.deleteMessages(successIds)
        }

        if (failures.isNotEmpty()) {
            logger.warn {
                "Outbox batch completed in ${durationMs}ms: ${successIds.size}/${messages.size} succeeded, ${failures.size} failed"
            }
            failures.forEach { result ->
                logger.debug(result.error) { "Failed to publish outbox message ${result.messageId}" }
            }
            // Stop polling on any failures — failed messages stay in the outbox and would be
            // re-fetched in the next batch, causing an infinite loop. Let the next scheduled
            // poll cycle retry them instead.
            return false
        }

        logger.debug { "Outbox batch completed in ${durationMs}ms: ${messages.size}/${messages.size} succeeded" }

        // Continue polling if this batch was full — there may be more messages waiting
        return messages.size >= batchSize
    }

    private fun isCircuitBreakerOpen() =
        circuitBreaker != null && circuitBreaker.state == CircuitBreaker.State.OPEN

    private fun isCircuitBreakerHalfOpen() =
        circuitBreaker != null && circuitBreaker.state == CircuitBreaker.State.HALF_OPEN

    companion object {
        const val DEFAULT_BATCH_SIZE = 10
        val logger = KotlinLogging.logger {}
    }
}
