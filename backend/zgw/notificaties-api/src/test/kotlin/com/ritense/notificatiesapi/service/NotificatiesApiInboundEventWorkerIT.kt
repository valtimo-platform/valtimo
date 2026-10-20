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
import com.ritense.notificatiesapi.BaseIntegrationTest
import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import net.javacrumbs.shedlock.core.LockConfiguration
import net.javacrumbs.shedlock.core.LockProvider
import net.javacrumbs.shedlock.core.SimpleLock
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.aop.support.AopUtils
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

class NotificatiesApiInboundEventWorkerIT : BaseIntegrationTest() {

    @Autowired
    lateinit var worker: NotificatiesApiInboundEventWorker

    @Autowired
    lateinit var lockProvider: LockProvider

    @Autowired
    lateinit var inboundEventRepository: NotificatiesApiInboundEventRepository

    @Autowired
    lateinit var processingProperties: NotificatiesApiProcessingProperties

    @Autowired
    lateinit var transactionTemplate: TransactionTemplate

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @BeforeEach
    fun cleanRepository() {
        transactionTemplate.executeWithoutResult { inboundEventRepository.deleteAll() }
    }

    @Test
    fun `maintenance is skipped while another instance holds the maintenance lock`() {
        assertTrue(AopUtils.isAopProxy(worker), "the @SchedulerLock interceptor is not applied to the worker")
        val expiredId = saveEvent(
            NotificatiesApiInboundEventStatus.PROCESSED,
            LocalDateTime.now().minus(processingProperties.retentionPeriod).minusDays(1)
        )

        val otherInstanceLock = acquireMaintenanceLock()
        try {
            worker.runMaintenance()
            assertTrue(inboundEventRepository.existsById(expiredId))
        } finally {
            otherInstanceLock.unlock()
        }

        // Either this call or a scheduled run that took the lock in between removes the row.
        worker.runMaintenance()
        awaitTrue { !inboundEventRepository.existsById(expiredId) }
    }

    @Test
    fun `poll still processes events through the lock proxy`() {
        val eventId = saveEvent(NotificatiesApiInboundEventStatus.RECEIVED, LocalDateTime.now().minusMinutes(5))

        worker.poll()

        assertEquals(NotificatiesApiInboundEventStatus.PROCESSED, inboundEventRepository.findById(eventId).get().status)
    }

    private fun saveEvent(status: NotificatiesApiInboundEventStatus, receivedAt: LocalDateTime): UUID {
        return transactionTemplate.execute {
            inboundEventRepository.save(
                NotificatiesApiInboundEvent(
                    idempotenceKey = UUID.randomUUID().toString(),
                    payload = samplePayload(),
                    status = status,
                    pendingRetries = if (status == NotificatiesApiInboundEventStatus.PROCESSED) 0 else processingProperties.initialRetries,
                    receivedAt = receivedAt
                )
            ).id
        }!!
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

    // The scheduled maintenance run may hold the lock (lockAtLeastFor) when the test starts; wait for it.
    private fun acquireMaintenanceLock(): SimpleLock {
        val deadline = Instant.now().plusSeconds(30)
        while (Instant.now().isBefore(deadline)) {
            val lock = lockProvider.lock(
                LockConfiguration(Instant.now(), MAINTENANCE_LOCK, Duration.ofMinutes(1), Duration.ZERO)
            )
            if (lock.isPresent) {
                return lock.get()
            }
            Thread.sleep(200)
        }
        fail("Could not acquire $MAINTENANCE_LOCK within 30 seconds")
    }

    private fun awaitTrue(condition: () -> Boolean) {
        val deadline = Instant.now().plusSeconds(30)
        while (!condition()) {
            if (Instant.now().isAfter(deadline)) {
                fail("Condition not met within 30 seconds")
            }
            Thread.sleep(200)
        }
    }

    companion object {
        private const val MAINTENANCE_LOCK = "NotificatiesApiInboundEventWorker_runMaintenance"
    }
}
