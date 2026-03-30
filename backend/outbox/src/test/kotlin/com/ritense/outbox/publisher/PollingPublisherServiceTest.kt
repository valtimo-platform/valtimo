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

package com.ritense.outbox.publisher

import com.ritense.outbox.OutboxMessage
import com.ritense.outbox.ValtimoOutboxService
import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import java.time.Duration

class PollingPublisherServiceTest {

    private lateinit var outboxService: ValtimoOutboxService
    private lateinit var messagePublisher: MessagePublisher
    private lateinit var transactionManager: PlatformTransactionManager

    @BeforeEach
    fun setUp() {
        outboxService = mock()
        messagePublisher = mock()
        transactionManager = mock {
            on { getTransaction(any()) }.thenReturn(SimpleTransactionStatus())
        }
    }

    @Test
    fun `should use default batch size of 10 with secondary constructor`() {
        val msg = OutboxMessage(message = "test")
        whenever(outboxService.getOldestMessages(10))
            .thenReturn(listOf(msg))
            .thenReturn(emptyList())
        whenever(messagePublisher.publishBatch(any())).thenReturn(
            listOf(MessagePublishResult(messageId = msg.id, success = true))
        )

        val service = PollingPublisherService(outboxService, messagePublisher, transactionManager)
        service.pollAndPublishAll()

        verify(outboxService).getOldestMessages(10)
    }

    @Test
    fun `should fetch messages with configured batch size`() {
        whenever(outboxService.getOldestMessages(5)).thenReturn(emptyList())

        val service = PollingPublisherService(
            outboxService, messagePublisher, transactionManager,
            batchSize = 5
        )
        service.pollAndPublishAll()

        verify(outboxService).getOldestMessages(5)
    }

    @Test
    fun `should delete successful messages and keep failed ones`() {
        val msg1 = OutboxMessage(message = "ok")
        val msg2 = OutboxMessage(message = "fail")
        val msg3 = OutboxMessage(message = "ok2")
        whenever(outboxService.getOldestMessages(any()))
            .thenReturn(listOf(msg1, msg2, msg3))
            .thenReturn(emptyList())
        whenever(messagePublisher.publishBatch(any())).thenReturn(
            listOf(
                MessagePublishResult(messageId = msg1.id, success = true),
                MessagePublishResult(messageId = msg2.id, success = false, error = RuntimeException("fail")),
                MessagePublishResult(messageId = msg3.id, success = true)
            )
        )

        val service = PollingPublisherService(outboxService, messagePublisher, transactionManager)
        service.pollAndPublishAll()

        verify(outboxService).deleteMessages(listOf(msg1.id, msg3.id))
    }

    @Test
    fun `should not call deleteMessages when all messages fail`() {
        val msg1 = OutboxMessage(message = "fail1")
        val msg2 = OutboxMessage(message = "fail2")
        whenever(outboxService.getOldestMessages(any())).thenReturn(listOf(msg1, msg2))
        whenever(messagePublisher.publishBatch(any())).thenReturn(
            listOf(
                MessagePublishResult(messageId = msg1.id, success = false, error = RuntimeException("fail")),
                MessagePublishResult(messageId = msg2.id, success = false, error = RuntimeException("fail"))
            )
        )

        val service = PollingPublisherService(outboxService, messagePublisher, transactionManager)
        service.pollAndPublishAll()

        verify(outboxService, never()).deleteMessages(any())
    }

    @Test
    fun `should stop polling when all messages in batch fail`() {
        val msg = OutboxMessage(message = "fail")
        whenever(outboxService.getOldestMessages(any())).thenReturn(listOf(msg))
        whenever(messagePublisher.publishBatch(any())).thenReturn(
            listOf(MessagePublishResult(messageId = msg.id, success = false, error = RuntimeException("fail")))
        )

        val service = PollingPublisherService(outboxService, messagePublisher, transactionManager)
        service.pollAndPublishAll()

        // Should only fetch once — loop stops after total failure
        verify(outboxService, times(1)).getOldestMessages(any())
    }

    @Test
    fun `should skip polling when circuit breaker is OPEN`() {
        val circuitBreaker = createCircuitBreaker(failureThreshold = 50f, minimumCalls = 1, slidingWindowSize = 1)
        // Force circuit breaker to OPEN
        circuitBreaker.transitionToOpenState()

        val service = PollingPublisherService(
            outboxService, messagePublisher, transactionManager,
            circuitBreaker = circuitBreaker
        )
        service.pollAndPublishAll()

        verify(outboxService, never()).getOldestMessages(any())
        verify(messagePublisher, never()).publishBatch(any())
    }

    @Test
    fun `should record successes on circuit breaker`() {
        val circuitBreaker = createCircuitBreaker(failureThreshold = 50f, minimumCalls = 1, slidingWindowSize = 10)
        val msg = OutboxMessage(message = "ok")
        whenever(outboxService.getOldestMessages(any()))
            .thenReturn(listOf(msg))
            .thenReturn(emptyList())
        whenever(messagePublisher.publishBatch(any())).thenReturn(
            listOf(MessagePublishResult(messageId = msg.id, success = true))
        )

        val service = PollingPublisherService(
            outboxService, messagePublisher, transactionManager,
            circuitBreaker = circuitBreaker
        )
        service.pollAndPublishAll()

        assertThat(circuitBreaker.metrics.numberOfSuccessfulCalls).isEqualTo(1)
        assertThat(circuitBreaker.state).isEqualTo(CircuitBreaker.State.CLOSED)
    }

    @Test
    fun `should record failures on circuit breaker and transition to OPEN`() {
        val circuitBreaker = createCircuitBreaker(
            failureThreshold = 50f,
            minimumCalls = 2,
            slidingWindowSize = 2
        )
        val msg1 = OutboxMessage(message = "fail1")
        val msg2 = OutboxMessage(message = "fail2")
        whenever(outboxService.getOldestMessages(any())).thenReturn(listOf(msg1, msg2))
        whenever(messagePublisher.publishBatch(any())).thenReturn(
            listOf(
                MessagePublishResult(messageId = msg1.id, success = false, error = RuntimeException("fail")),
                MessagePublishResult(messageId = msg2.id, success = false, error = RuntimeException("fail"))
            )
        )

        val service = PollingPublisherService(
            outboxService, messagePublisher, transactionManager,
            circuitBreaker = circuitBreaker
        )
        service.pollAndPublishAll()

        assertThat(circuitBreaker.metrics.numberOfFailedCalls).isEqualTo(2)
        assertThat(circuitBreaker.state).isEqualTo(CircuitBreaker.State.OPEN)
    }

    @Test
    fun `should stop loop when circuit breaker opens mid-batch`() {
        val circuitBreaker = createCircuitBreaker(
            failureThreshold = 100f,
            minimumCalls = 1,
            slidingWindowSize = 1
        )
        val failMsg = OutboxMessage(message = "fail")
        val okMsg = OutboxMessage(message = "ok")
        // First batch: all fail → circuit opens. Second batch should not be fetched.
        whenever(outboxService.getOldestMessages(any()))
            .thenReturn(listOf(failMsg))
            .thenReturn(listOf(okMsg))
        whenever(messagePublisher.publishBatch(listOf(failMsg))).thenReturn(
            listOf(MessagePublishResult(messageId = failMsg.id, success = false, error = RuntimeException("fail")))
        )

        val service = PollingPublisherService(
            outboxService, messagePublisher, transactionManager,
            circuitBreaker = circuitBreaker
        )
        service.pollAndPublishAll()

        // Circuit opened after first batch, so second batch is never fetched
        verify(outboxService, times(1)).getOldestMessages(any())
        assertThat(circuitBreaker.state).isEqualTo(CircuitBreaker.State.OPEN)
    }

    @Test
    fun `should continue polling when batch is full`() {
        val batchSize = 2
        val msg1 = OutboxMessage(message = "ok1")
        val msg2 = OutboxMessage(message = "ok2")
        val msg3 = OutboxMessage(message = "ok3")
        // First batch: full (2 messages) → continue. Second batch: partial (1 message) → stop.
        whenever(outboxService.getOldestMessages(batchSize))
            .thenReturn(listOf(msg1, msg2))
            .thenReturn(listOf(msg3))
            .thenReturn(emptyList())
        whenever(messagePublisher.publishBatch(listOf(msg1, msg2))).thenReturn(
            listOf(
                MessagePublishResult(messageId = msg1.id, success = true),
                MessagePublishResult(messageId = msg2.id, success = true)
            )
        )
        whenever(messagePublisher.publishBatch(listOf(msg3))).thenReturn(
            listOf(MessagePublishResult(messageId = msg3.id, success = true))
        )

        val service = PollingPublisherService(
            outboxService, messagePublisher, transactionManager,
            batchSize = batchSize
        )
        service.pollAndPublishAll()

        verify(outboxService, times(2)).getOldestMessages(batchSize)
        verify(outboxService).deleteMessages(listOf(msg1.id, msg2.id))
        verify(outboxService).deleteMessages(listOf(msg3.id))
    }

    @Test
    fun `should stop polling when batch is smaller than batch size`() {
        val batchSize = 5
        val msg = OutboxMessage(message = "ok")
        whenever(outboxService.getOldestMessages(batchSize)).thenReturn(listOf(msg))
        whenever(messagePublisher.publishBatch(any())).thenReturn(
            listOf(MessagePublishResult(messageId = msg.id, success = true))
        )

        val service = PollingPublisherService(
            outboxService, messagePublisher, transactionManager,
            batchSize = batchSize
        )
        service.pollAndPublishAll()

        // Only one fetch — batch smaller than batchSize means no more messages
        verify(outboxService, times(1)).getOldestMessages(batchSize)
    }

    @Test
    fun `should use batch size of 1 when circuit breaker is HALF_OPEN`() {
        val circuitBreaker = createCircuitBreaker(
            failureThreshold = 100f,
            minimumCalls = 1,
            slidingWindowSize = 1
        )
        circuitBreaker.transitionToOpenState()
        circuitBreaker.transitionToHalfOpenState()

        val msg = OutboxMessage(message = "ok")
        whenever(outboxService.getOldestMessages(1)).thenReturn(listOf(msg))
        whenever(outboxService.getOldestMessages(5)).thenReturn(emptyList())
        whenever(messagePublisher.publishBatch(any())).thenReturn(
            listOf(MessagePublishResult(messageId = msg.id, success = true))
        )

        val service = PollingPublisherService(
            outboxService, messagePublisher, transactionManager,
            batchSize = 5,
            circuitBreaker = circuitBreaker
        )
        service.pollAndPublishAll()

        // First fetch uses batch size 1 (HALF_OPEN), then circuit closes and resumes normal batch size
        verify(outboxService).getOldestMessages(1)
        assertThat(circuitBreaker.state).isEqualTo(CircuitBreaker.State.CLOSED)
    }

    private fun createCircuitBreaker(
        failureThreshold: Float,
        minimumCalls: Int,
        slidingWindowSize: Int
    ): CircuitBreaker {
        val config = CircuitBreakerConfig.custom()
            .failureRateThreshold(failureThreshold)
            .minimumNumberOfCalls(minimumCalls)
            .slidingWindowSize(slidingWindowSize)
            .waitDurationInOpenState(Duration.ofSeconds(60))
            .permittedNumberOfCallsInHalfOpenState(1)
            .build()
        return CircuitBreaker.of("test", config)
    }
}
