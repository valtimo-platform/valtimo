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
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import com.ritense.notificatiesapi.config.NotificatiesApiProcessingProperties
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEvent
import com.ritense.notificatiesapi.domain.NotificatiesApiInboundEventStatus
import com.ritense.notificatiesapi.event.NotificatiesApiNotificationReceivedEvent
import com.ritense.notificatiesapi.repository.NotificatiesApiInboundEventRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.TransactionStatus
import org.springframework.transaction.support.SimpleTransactionStatus
import java.time.Duration
import java.time.LocalDateTime
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class NotificatiesApiInboundEventProcessingServiceTest {

    private lateinit var repository: NotificatiesApiInboundEventRepository
    private lateinit var publisher: ApplicationEventPublisher
    private lateinit var properties: NotificatiesApiProcessingProperties
    private lateinit var objectMapper: ObjectMapper
    private lateinit var service: NotificatiesApiInboundEventProcessingService
    private lateinit var transactionManager: PlatformTransactionManager

    @BeforeEach
    fun setup() {
        repository = mock()
        publisher = mock()
        properties = NotificatiesApiProcessingProperties().apply {
            initialRetries = 2
            retryDelay = Duration.ofSeconds(5)
            retentionPeriod = Duration.ofMinutes(5)
            receivedWarningThreshold = Duration.ofMinutes(1)
            batchSize = 10
        }
        objectMapper = ObjectMapper()
            .registerKotlinModule()
            .registerModule(JavaTimeModule())
        transactionManager = NoOpTransactionManager()
        service = NotificatiesApiInboundEventProcessingService(
            repository,
            publisher,
            objectMapper,
            properties,
            transactionManager
        )
    }

    @Test
    fun `processes received event successfully`() {
        val event = inboundEvent(NotificatiesApiInboundEventStatus.RECEIVED)
        whenever(repository.fetchNextBatchForProcessing(properties.batchSize)).thenReturn(listOf(event), emptyList())
        whenever(repository.deleteByStatusAndReceivedAtBefore(any(), any())).thenReturn(0)
        whenever(repository.existsByStatusAndReceivedAtBefore(any(), any())).thenReturn(false)

        service.processBatch()

        verify(publisher).publishEvent(any<NotificatiesApiNotificationReceivedEvent>())
        assertEquals(NotificatiesApiInboundEventStatus.PROCESSED, event.status)
        assertEquals(0, event.pendingRetries)
        assertNotNull(event.lastProcessedAt)
        assertNull(event.lastErrorMessage)
        assertNull(event.nextDueAt)
    }

    @Test
    fun `process event locks and processes single record`() {
        val event = inboundEvent(NotificatiesApiInboundEventStatus.RECEIVED)
        whenever(repository.findByIdForUpdate(event.id)).thenReturn(event)
        whenever(repository.deleteByStatusAndReceivedAtBefore(any(), any())).thenReturn(0)
        whenever(repository.existsByStatusAndReceivedAtBefore(any(), any())).thenReturn(false)

        service.processEvent(event.id)

        verify(publisher).publishEvent(any<NotificatiesApiNotificationReceivedEvent>())
        assertEquals(NotificatiesApiInboundEventStatus.PROCESSED, event.status)
        assertNull(event.nextDueAt)
    }

    @Test
    fun `marks failed event and decrements retries`() {
        val event = inboundEvent(NotificatiesApiInboundEventStatus.RECEIVED, payload = "not-json")
        whenever(repository.fetchNextBatchForProcessing(properties.batchSize)).thenReturn(listOf(event), emptyList())
        whenever(repository.deleteByStatusAndReceivedAtBefore(any(), any())).thenReturn(0)
        whenever(repository.existsByStatusAndReceivedAtBefore(any(), any())).thenReturn(false)

        service.processBatch()

        assertEquals(NotificatiesApiInboundEventStatus.FAILED, event.status)
        assertEquals(properties.initialRetries - 1, event.pendingRetries)
        assertNotNull(event.lastProcessedAt)
        assertNotNull(event.lastErrorMessage)
        val expectedNextDue = event.lastProcessedAt!!.plus(properties.retryDelay)
        assertEquals(expectedNextDue, event.nextDueAt)
    }

    @Test
    fun `triggers cleanup when batch empty`() {
        whenever(repository.fetchNextBatchForProcessing(properties.batchSize)).thenReturn(emptyList())
        whenever(repository.deleteByStatusAndReceivedAtBefore(any(), any())).thenReturn(1)
        whenever(repository.existsByStatusAndReceivedAtBefore(any(), any())).thenReturn(false)

        service.processBatch()

        verify(repository).deleteByStatusAndReceivedAtBefore(any(), any())
    }

    @Test
    fun `maintenance failure does not propagate and starts only after the batch transaction committed`() {
        val recordingTransactionManager = RecordingTransactionManager()
        service = NotificatiesApiInboundEventProcessingService(
            repository,
            publisher,
            objectMapper,
            properties,
            recordingTransactionManager
        )
        val event = inboundEvent(NotificatiesApiInboundEventStatus.RECEIVED)
        whenever(repository.fetchNextBatchForProcessing(properties.batchSize)).thenReturn(listOf(event), emptyList())
        whenever(repository.deleteByStatusAndReceivedAtBefore(any(), any())).thenThrow(IllegalStateException("cleanup failed"))

        service.processBatch()

        assertEquals(NotificatiesApiInboundEventStatus.PROCESSED, event.status)
        assertEquals(
            listOf(
                "begin REQUIRED",
                "begin NOT_SUPPORTED",
                "commit NOT_SUPPORTED",
                "commit REQUIRED",
                "begin REQUIRES_NEW",
                "rollback REQUIRES_NEW"
            ),
            recordingTransactionManager.log
        )
    }

    private fun inboundEvent(
        status: NotificatiesApiInboundEventStatus,
        payload: String = objectMapper.writeValueAsString(sampleNotification())
    ): NotificatiesApiInboundEvent {
        return NotificatiesApiInboundEvent(
            idempotenceKey = "key",
            payload = payload,
            status = status,
            pendingRetries = properties.initialRetries,
            receivedAt = LocalDateTime.now()
        )
    }

    private fun sampleNotification(): NotificatiesApiNotificationReceivedEvent {
        return NotificatiesApiNotificationReceivedEvent(
            kanaal = "kanaal",
            resourceUrl = "http://example.com",
            hoofdObject = "http://example.com/object/1",
            actie = "update",
            aanmaakdatum = LocalDateTime.now(),
            kenmerken = mapOf("a" to "1"),
            resource = null
        )
    }
}

private class NoOpTransactionManager : PlatformTransactionManager {
    override fun getTransaction(definition: TransactionDefinition?): TransactionStatus = SimpleTransactionStatus()
    override fun commit(status: TransactionStatus) {}
    override fun rollback(status: TransactionStatus) {}
}

private class RecordingTransactionManager : PlatformTransactionManager {
    val log = mutableListOf<String>()
    private val open = ArrayDeque<String>()

    override fun getTransaction(definition: TransactionDefinition?): TransactionStatus {
        val propagation = when (definition?.propagationBehavior ?: TransactionDefinition.PROPAGATION_REQUIRED) {
            TransactionDefinition.PROPAGATION_REQUIRES_NEW -> "REQUIRES_NEW"
            TransactionDefinition.PROPAGATION_NOT_SUPPORTED -> "NOT_SUPPORTED"
            TransactionDefinition.PROPAGATION_REQUIRED -> "REQUIRED"
            else -> "OTHER"
        }
        open.addLast(propagation)
        log += "begin $propagation"
        return SimpleTransactionStatus()
    }

    override fun commit(status: TransactionStatus) {
        log += "commit ${open.removeLast()}"
    }

    override fun rollback(status: TransactionStatus) {
        log += "rollback ${open.removeLast()}"
    }
}
