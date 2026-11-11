/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import com.ritense.notificatiesapi.BaseIntegrationTest
import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.TestPropertySource
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// Keeps the scheduled worker out of the way; the tests drive processing themselves.
@TestPropertySource(properties = ["valtimo.notificaties-api.processing.poll-interval=PT1H"])
class NotificatiesApiInboundEventMaintenanceConcurrencyIT : BaseIntegrationTest() {

    @Autowired
    lateinit var processingService: NotificatiesApiInboundEventProcessingService

    @Autowired
    lateinit var inboundEventRepository: NotificatiesApiInboundEventRepository

    @Autowired
    lateinit var processingProperties: NotificatiesApiProcessingProperties

    @Autowired
    lateinit var transactionTemplate: TransactionTemplate

    @Autowired
    lateinit var objectMapper: ObjectMapper

    private val executor = Executors.newFixedThreadPool(2)

    @BeforeEach
    fun cleanRepository() {
        transactionTemplate.executeWithoutResult { inboundEventRepository.deleteAll() }
    }

    @AfterEach
    fun shutdownExecutor() {
        executor.shutdownNow()
    }

    @Test
    fun `maintenance does not fail when another instance deletes the same expired events`() {
        repeat(3) { saveExpiredProcessedEvent() }

        val otherInstance = holdCleanupOfExpiredEvents()
        val maintenance = executor.submit { processingService.runMaintenance() }
        Thread.sleep(BLOCK_WAIT_MS)
        assertFalse(maintenance.isDone, "maintenance should be waiting on the row locks of the other instance")
        otherInstance.commit()

        assertDoesNotThrow { maintenance.get(30, TimeUnit.SECONDS) }
        assertEquals(0, inboundEventRepository.count())
    }

    @Test
    fun `events processed in a poll are not rolled back when another instance deletes the same expired events`() {
        repeat(3) { saveExpiredProcessedEvent() }
        val retryId = saveDueFailedEvent()

        val otherInstance = holdCleanupOfExpiredEvents()
        val poll = executor.submit<Result<Unit>> { runCatching { processingService.processBatch() } }
        Thread.sleep(BLOCK_WAIT_MS)
        otherInstance.commit()
        poll.get(30, TimeUnit.SECONDS)

        assertEquals(
            NotificatiesApiInboundEventStatus.PROCESSED,
            inboundEventRepository.findById(retryId).get().status
        )
    }

    private fun holdCleanupOfExpiredEvents(): HeldTransaction {
        val holding = CountDownLatch(1)
        val release = CountDownLatch(1)
        val future = executor.submit {
            transactionTemplate.executeWithoutResult {
                inboundEventRepository.deleteByStatusAndReceivedAtBefore(
                    NotificatiesApiInboundEventStatus.PROCESSED,
                    LocalDateTime.now().minus(processingProperties.retentionPeriod)
                )
                inboundEventRepository.flush()
                holding.countDown()
                release.await()
            }
        }
        assertTrue(holding.await(30, TimeUnit.SECONDS), "other instance did not start its cleanup")
        return HeldTransaction(release, future)
    }

    private class HeldTransaction(private val release: CountDownLatch, private val future: Future<*>) {
        fun commit() {
            release.countDown()
            future.get(30, TimeUnit.SECONDS)
        }
    }

    private fun saveExpiredProcessedEvent() {
        save(
            NotificatiesApiInboundEvent(
                idempotenceKey = UUID.randomUUID().toString(),
                payload = samplePayload(),
                status = NotificatiesApiInboundEventStatus.PROCESSED,
                pendingRetries = 0,
                receivedAt = LocalDateTime.now().minus(processingProperties.retentionPeriod).minusDays(1),
                nextDueAt = null
            )
        )
    }

    private fun saveDueFailedEvent(): UUID {
        return save(
            NotificatiesApiInboundEvent(
                idempotenceKey = UUID.randomUUID().toString(),
                payload = samplePayload(),
                status = NotificatiesApiInboundEventStatus.FAILED,
                pendingRetries = 2,
                receivedAt = LocalDateTime.now().minusMinutes(10),
                nextDueAt = LocalDateTime.now().minusMinutes(1)
            )
        )
    }

    private fun save(event: NotificatiesApiInboundEvent): UUID {
        return transactionTemplate.execute { inboundEventRepository.save(event).id }!!
    }

    private fun samplePayload(): String {
        return objectMapper.writeValueAsString(
            NotificatiesApiNotificationReceivedEvent(
                kanaal = "test",
                resourceUrl = "http://example.com/${UUID.randomUUID()}",
                hoofdObject = null,
                actie = "update",
                aanmaakdatum = LocalDateTime.now(),
                kenmerken = emptyMap(),
                resource = null
            )
        )
    }

    companion object {
        private const val BLOCK_WAIT_MS = 2000L
    }
}
