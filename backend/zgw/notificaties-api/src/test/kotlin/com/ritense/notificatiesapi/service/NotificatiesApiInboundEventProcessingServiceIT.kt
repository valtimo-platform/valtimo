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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.notificatiesapi.BaseIntegrationTest
import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.event.EventListener
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionTemplate
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

@Import(FailingListenerConfig::class)
class NotificatiesApiInboundEventProcessingServiceIT : BaseIntegrationTest() {

    @Autowired
    lateinit var inboundEventRepository: NotificatiesApiInboundEventRepository

    @Autowired
    lateinit var processingService: NotificatiesApiInboundEventProcessingService

    @Autowired
    lateinit var transactionTemplate: TransactionTemplate

    @Autowired
    lateinit var processingProperties: NotificatiesApiProcessingProperties

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var applicationContext: ApplicationContext

    private lateinit var failingListener: CountingFailingListener

    @BeforeEach
    fun cleanRepository() {
        transactionTemplate.executeWithoutResult { inboundEventRepository.deleteAll() }
        failingListener = applicationContext.getBean(CountingFailingListener::class.java)
        failingListener.reset()
    }

    @Test
    fun `listener failure should not rollback processing transaction`() {
        val eventId = transactionTemplate.execute {
            val event = NotificatiesApiInboundEvent(
                idempotenceKey = UUID.randomUUID().toString(),
                payload = samplePayload(),
                status = NotificatiesApiInboundEventStatus.RECEIVED,
                pendingRetries = processingProperties.initialRetries,
                receivedAt = LocalDateTime.now().minusMinutes(5)
            )
            inboundEventRepository.save(event)
            event.id
        }!!

        processingService.processBatch()

        val persisted = inboundEventRepository.findById(eventId).orElseThrow()
        assertEquals(NotificatiesApiInboundEventStatus.FAILED, persisted.status)
        assertEquals(processingProperties.initialRetries - 1, persisted.pendingRetries)
        assertNotNull(persisted.lastErrorMessage)
        assertEquals(1, failingListener.invocations())
    }

    private fun samplePayload(): String {
        val notification = NotificatiesApiNotificationReceivedEvent(
            kanaal = "test",
            resourceUrl = "http://example.com/${UUID.randomUUID()}",
            hoofdObject = null,
            actie = "update",
            aanmaakdatum = LocalDateTime.now(),
            kenmerken = mapOf("bronId" to UUID.randomUUID().toString()),
            resource = null
        )
        return objectMapper.writeValueAsString(notification)
    }

}

@TestConfiguration
class FailingListenerConfig {
    @Bean
    fun countingFailingListener() = CountingFailingListener()
}

open class CountingFailingListener {
    companion object {
        private val counter = AtomicInteger(0)
    }

    @EventListener
    @Transactional(propagation = Propagation.REQUIRED)
    open fun onNotification(event: NotificatiesApiNotificationReceivedEvent) {
        counter.incrementAndGet()
        throw IllegalStateException("Simulated listener failure")
    }

    fun invocations(): Int = counter.get()

    fun reset() {
        counter.set(0)
    }
}
