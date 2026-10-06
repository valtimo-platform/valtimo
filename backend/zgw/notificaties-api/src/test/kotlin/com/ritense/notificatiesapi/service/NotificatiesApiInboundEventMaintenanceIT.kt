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

package com.ritense.notificatiesapi.service

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.notificatiesapi.BaseIntegrationTest
import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus.FAILED
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus.PROCESSED
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus.RECEIVED
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import jakarta.persistence.EntityManager
import org.hibernate.Session
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NotificatiesApiInboundEventMaintenanceIT : BaseIntegrationTest() {

    @Autowired
    lateinit var inboundEventRepository: NotificatiesApiInboundEventRepository

    @Autowired
    lateinit var processingService: NotificatiesApiInboundEventProcessingService

    @Autowired
    lateinit var processingProperties: NotificatiesApiProcessingProperties

    @Autowired
    lateinit var transactionTemplate: TransactionTemplate

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var entityManager: EntityManager

    @Autowired
    lateinit var objectMapper: ObjectMapper

    private val logAppender = ListAppender<ILoggingEvent>()
    private val moduleLogger = LoggerFactory.getLogger("com.ritense.notificatiesapi") as Logger
    private lateinit var originalRetention: Duration

    @BeforeEach
    fun setUp() {
        transactionTemplate.executeWithoutResult { inboundEventRepository.deleteAll() }
        originalRetention = processingProperties.retentionPeriod
        logAppender.list.clear()
        logAppender.start()
        moduleLogger.addAppender(logAppender)
    }

    @AfterEach
    fun tearDown() {
        moduleLogger.detachAppender(logAppender)
        processingProperties.retentionPeriod = originalRetention
    }

    @Test
    fun `cleanup racing another instance does not fail or undo the events processed in the same poll`() {
        val expired = expiredReceivedAt()
        val takenByOtherInstance = save(PROCESSED, receivedAt = expired)
        val untouchedExpired = save(PROCESSED, receivedAt = expired)
        val received = save(RECEIVED, receivedAt = LocalDateTime.now().minusMinutes(1))

        val otherInstanceDeleted = CountDownLatch(1)
        val otherInstance = CompletableFuture.runAsync {
            transactionTemplate.executeWithoutResult {
                jdbcTemplate.update("DELETE FROM notificaties_api_inbound_event WHERE id = ?", takenByOtherInstance)
                otherInstanceDeleted.countDown()
                Thread.sleep(OTHER_INSTANCE_COMMIT_DELAY.toMillis())
            }
        }
        assertTrue(otherInstanceDeleted.await(10, TimeUnit.SECONDS))

        processingService.processBatch()
        otherInstance.get(30, TimeUnit.SECONDS)

        assertEquals(PROCESSED, inboundEventRepository.findById(received).orElseThrow().status)
        assertFalse(inboundEventRepository.existsById(takenByOtherInstance))
        assertFalse(inboundEventRepository.existsById(untouchedExpired))
        assertEquals(emptyList(), errorsLogged())
    }

    @Test
    fun `cleanup removes only processed events older than the retention period`() {
        val expired = expiredReceivedAt()
        val notDueYet = LocalDateTime.now().plusDays(1)
        val expiredProcessed = save(PROCESSED, receivedAt = expired)
        val recentProcessed = save(PROCESSED, receivedAt = LocalDateTime.now().minusMinutes(1))
        val oldReceived = save(RECEIVED, receivedAt = expired, nextDueAt = notDueYet)
        val oldFailed = save(FAILED, receivedAt = expired, nextDueAt = notDueYet)
        val oldFailedExhausted = save(FAILED, receivedAt = expired, nextDueAt = null, pendingRetries = 0)

        processingService.processBatch()

        assertFalse(inboundEventRepository.existsById(expiredProcessed))
        assertTrue(inboundEventRepository.existsById(recentProcessed))
        assertTrue(inboundEventRepository.existsById(oldReceived))
        assertTrue(inboundEventRepository.existsById(oldFailed))
        assertTrue(inboundEventRepository.existsById(oldFailedExhausted))
    }

    @Test
    fun `cleanup is skipped when the retention period is zero`() {
        val expiredProcessed = save(PROCESSED, receivedAt = expiredReceivedAt())
        processingProperties.retentionPeriod = Duration.ZERO

        processingService.processBatch()

        assertTrue(inboundEventRepository.existsById(expiredProcessed))
    }

    @Test
    fun `cleanup deletes in bulk without loading the events into the persistence context`() {
        val expired = expiredReceivedAt()
        val ids = (1..3).map { save(PROCESSED, receivedAt = expired) }

        val managedAfterDelete = transactionTemplate.execute {
            val removed = inboundEventRepository.deleteByStatusAndReceivedAtBefore(PROCESSED, expired.plusSeconds(1))
            assertEquals(3L, removed)
            entityManager.unwrap(Session::class.java).statistics.entityCount
        }

        assertEquals(0, managedAfterDelete)
        ids.forEach { assertFalse(inboundEventRepository.existsById(it)) }
    }

    private fun expiredReceivedAt(): LocalDateTime =
        LocalDateTime.now().minus(processingProperties.retentionPeriod).minusDays(1)

    private fun errorsLogged(): List<String> =
        logAppender.list.filter { it.level.isGreaterOrEqual(Level.ERROR) }.map { it.formattedMessage }

    private fun save(
        status: NotificatiesApiInboundEventStatus,
        receivedAt: LocalDateTime,
        nextDueAt: LocalDateTime? = if (status == PROCESSED) null else receivedAt,
        pendingRetries: Int = processingProperties.initialRetries,
    ): UUID = transactionTemplate.execute {
        inboundEventRepository.save(
            NotificatiesApiInboundEvent(
                idempotenceKey = UUID.randomUUID().toString(),
                payload = samplePayload(),
                status = status,
                pendingRetries = pendingRetries,
                receivedAt = receivedAt,
                nextDueAt = nextDueAt
            )
        ).id
    }!!

    private fun samplePayload(): String = objectMapper.writeValueAsString(
        NotificatiesApiNotificationReceivedEvent(
            kanaal = "test",
            resourceUrl = "http://example.com/${UUID.randomUUID()}",
            hoofdObject = null,
            actie = "update",
            aanmaakdatum = LocalDateTime.now(),
            kenmerken = mapOf("bronId" to UUID.randomUUID().toString()),
            resource = null
        )
    )

    companion object {
        private val OTHER_INSTANCE_COMMIT_DELAY: Duration = Duration.ofSeconds(2)
    }
}
