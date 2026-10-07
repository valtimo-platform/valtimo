/*
 *  Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package com.ritense.valtimo.web.sse.service

import com.ritense.valtimo.web.sse.MutableClock
import com.ritense.valtimo.web.sse.TestSseEvent
import com.ritense.valtimo.web.sse.config.SseProperties
import com.ritense.valtimo.web.sse.domain.Subscriber
import com.ritense.valtimo.web.sse.event.EstablishedConnectionSseEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertDoesNotThrow
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import com.ritense.valtimo.web.sse.awaitUntil
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.io.IOException
import java.time.Duration
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executor
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicInteger
import java.util.function.Consumer

class SseSubscriptionServiceTest {

    private val clock = MutableClock()
    private val properties = SseProperties().apply {
        connectionTimeout = Duration.ofMinutes(5)
        heartbeatInterval = Duration.ofSeconds(30)
        reconnectGracePeriod = Duration.ofMinutes(2)
        maxQueuedEvents = 10
    }
    private val sentPerSubscriber = ConcurrentHashMap<Subscriber, MutableList<Any>>()
    private val heartbeats = ConcurrentHashMap<Subscriber, AtomicInteger>()
    private val timeouts = ConcurrentHashMap<Subscriber, Long>()
    private val directExecutor = Executor { it.run() }

    private fun newMockSubscriber(timeout: Long): Subscriber {
        val subscriber = mock<Subscriber>()
        val sent = CopyOnWriteArrayList<Any>()
        val beats = AtomicInteger()
        doAnswer { sent += it.getArgument<Any>(0); null }.whenever(subscriber).send(any<Any>())
        doAnswer { beats.incrementAndGet(); null }.whenever(subscriber).send(any<SseEmitter.SseEventBuilder>())
        sentPerSubscriber[subscriber] = sent
        heartbeats[subscriber] = beats
        timeouts[subscriber] = timeout
        return subscriber
    }

    private fun service(sender: Executor = directExecutor) =
        SseSubscriptionService(properties, clock, sender, ::newMockSubscriber)

    private fun sentTo(subscriber: Subscriber) = sentPerSubscriber.getValue(subscriber)

    private fun establishedId(subscriber: Subscriber): UUID =
        sentTo(subscriber).filterIsInstance<EstablishedConnectionSseEvent>().single().subscriptionId

    @Test
    fun `new subscription sends established event with its id and uses configured timeout`() {
        val service = service()

        val subscriber = service.subscribe()

        val id = establishedId(subscriber)
        assertThat(service.isConnected(id)).isTrue()
        assertThat(service.stats()).isEqualTo(SseSubscriptionStats(subscriptions = 1, connected = 1, queuedEvents = 0))
        assertThat(timeouts[subscriber]).isEqualTo(Duration.ofMinutes(5).toMillis())
    }

    @Test
    fun `subscribe with unknown id creates a new subscription`() {
        val service = service()

        val subscriber = service.subscribe(UUID.randomUUID())

        assertThat(sentTo(subscriber).filterIsInstance<EstablishedConnectionSseEvent>()).hasSize(1)
        assertThat(service.stats().subscriptions).isEqualTo(1)
    }

    @Test
    fun `reconnect reuses the subscription, replays queued events and completes the previous emitter`() {
        val service = service()
        val first = service.subscribe()
        val id = establishedId(first)
        doThrow(IOException("Broken pipe")).whenever(first).send(any<Any>())
        service.notifySubscribers(TestSseEvent(1))
        service.notifySubscribers(TestSseEvent(2))
        assertThat(service.isConnected(id)).isFalse()
        assertThat(service.queuedEventCount(id)).isEqualTo(2)

        val second = service.subscribe(id)

        assertThat(second).isNotSameAs(first)
        assertThat(sentTo(second).filterIsInstance<TestSseEvent>().map { it.seq }).containsExactly(1, 2)
        assertThat(sentTo(second).filterIsInstance<EstablishedConnectionSseEvent>()).isEmpty()
        assertThat(service.stats()).isEqualTo(SseSubscriptionStats(subscriptions = 1, connected = 1, queuedEvents = 0))
    }

    @Test
    fun `reconnect while still connected swaps the emitter and completes the old one`() {
        val service = service()
        val first = service.subscribe()
        val id = establishedId(first)

        val second = service.subscribe(id)

        verify(first).complete()
        service.notifySubscribers(TestSseEvent(1))
        assertThat(sentTo(second).filterIsInstance<TestSseEvent>()).hasSize(1)
        assertThat(sentTo(first).filterIsInstance<TestSseEvent>()).isEmpty()
    }

    @Test
    fun `notify reaches every subscriber and a failing one does not stop the others`() {
        val service = service()
        val a = service.subscribe()
        val b = service.subscribe()
        val c = service.subscribe()
        doThrow(IOException("Broken pipe")).whenever(b).send(any<Any>())

        service.notifySubscribers(TestSseEvent(1))

        assertThat(sentTo(a).filterIsInstance<TestSseEvent>()).hasSize(1)
        assertThat(sentTo(c).filterIsInstance<TestSseEvent>()).hasSize(1)
        assertThat(service.stats()).isEqualTo(SseSubscriptionStats(subscriptions = 3, connected = 2, queuedEvents = 1))
    }

    @Test
    fun `unexpected failure removes only that subscription`() {
        val service = service()
        val a = service.subscribe()
        val b = service.subscribe()
        doThrow(RuntimeException("serializer exploded")).whenever(b).send(any<Any>())

        assertDoesNotThrow { service.notifySubscribers(TestSseEvent(1)) }

        assertThat(sentTo(a).filterIsInstance<TestSseEvent>()).hasSize(1)
        assertThat(service.stats().subscriptions).isEqualTo(1)
        verify(b).completeWithError(any())
    }

    @Test
    fun `queued events per disconnected subscription are bounded`() {
        val service = service()
        val subscriber = service.subscribe()
        val id = establishedId(subscriber)
        doThrow(IOException("Broken pipe")).whenever(subscriber).send(any<Any>())

        repeat(1_000) { service.notifySubscribers(TestSseEvent(it)) }

        assertThat(service.queuedEventCount(id)).isEqualTo(properties.maxQueuedEvents)
    }

    @Test
    fun `maintenance evicts subscriptions disconnected beyond the grace period and keeps connected ones`() {
        val service = service()
        val gone = service.subscribe()
        val goneId = establishedId(gone)
        val alive = service.subscribe()
        val aliveId = establishedId(alive)
        doThrow(IOException("Broken pipe")).whenever(gone).send(any<Any>())
        service.notifySubscribers(TestSseEvent(1))
        assertThat(service.isConnected(goneId)).isFalse()

        clock.advance(Duration.ofMinutes(1))
        service.runMaintenance()
        assertThat(service.stats().subscriptions).isEqualTo(2)

        clock.advance(Duration.ofMinutes(1))
        service.runMaintenance()
        assertThat(service.stats()).isEqualTo(SseSubscriptionStats(subscriptions = 1, connected = 1, queuedEvents = 0))
        assertThat(service.isConnected(aliveId)).isTrue()

        clock.advance(Duration.ofHours(5))
        service.runMaintenance()
        assertThat(service.stats().subscriptions).isEqualTo(1)
    }

    @Test
    fun `subscription that never connected is evicted too`() {
        val service = service()
        val subscriber = service.subscribe()
        val id = establishedId(subscriber)
        completionCallback(subscriber).run()
        assertThat(service.isConnected(id)).isFalse()

        clock.advance(properties.reconnectGracePeriod)
        service.runMaintenance()

        assertThat(service.stats().subscriptions).isZero()
    }

    @Test
    fun `maintenance heartbeats connected subscribers and detects gone clients`() {
        val service = service()
        val alive = service.subscribe()
        val gone = service.subscribe()
        val goneId = establishedId(gone)
        doThrow(IOException("Connection reset")).whenever(gone).send(any<SseEmitter.SseEventBuilder>())

        service.runMaintenance()

        verify(alive).send(any<SseEmitter.SseEventBuilder>())
        assertThat(service.isConnected(goneId)).isFalse()

        clock.advance(properties.reconnectGracePeriod)
        service.runMaintenance()
        assertThat(service.stats().subscriptions).isEqualTo(1)
    }

    @Test
    fun `heartbeat can be disabled`() {
        properties.heartbeatInterval = Duration.ZERO
        val service = service()
        val subscriber = service.subscribe()

        service.runMaintenance()

        verify(subscriber, never()).send(any<SseEmitter.SseEventBuilder>())
    }

    @Test
    fun `notify does not send on the calling thread`() {
        val pending = mutableListOf<Runnable>()
        val service = service(sender = Executor { pending += it })
        val subscriber = service.subscribe()

        service.notifySubscribers(TestSseEvent(1))

        assertThat(sentTo(subscriber).filterIsInstance<TestSseEvent>()).isEmpty()
        assertThat(pending).hasSize(1)
        pending.single().run()
        assertThat(sentTo(subscriber).filterIsInstance<TestSseEvent>()).hasSize(1)
    }

    @Test
    fun `saturated sender drops the notification instead of failing the caller`() {
        val service = service(sender = Executor { throw RejectedExecutionException("full") })
        service.subscribe()

        assertDoesNotThrow { service.notifySubscribers(TestSseEvent(1)) }
    }

    @Test
    fun `default sender runs notifications on its own thread`() {
        val service = SseSubscriptionService(properties, clock, null, ::newMockSubscriber)
        val subscriber = service.subscribe()

        service.notifySubscribers(TestSseEvent(1))

        awaitUntil { sentTo(subscriber).filterIsInstance<TestSseEvent>().isNotEmpty() }
        service.stop()
    }

    @Test
    fun `start schedules maintenance and stop completes emitters`() {
        properties.heartbeatInterval = Duration.ofMillis(50)
        val service = SseSubscriptionService(properties, clock, null, ::newMockSubscriber)
        service.start()
        val subscriber = service.subscribe()

        awaitUntil { heartbeats.getValue(subscriber).get() > 0 }

        service.stop()
        verify(subscriber).complete()
        assertThat(service.stats().subscriptions).isZero()
    }

    @Test
    fun `timeout callback completes the emitter so the browser reconnects and detaches it`() {
        val service = service()
        val subscriber = service.subscribe()
        val id = establishedId(subscriber)

        timeoutCallback(subscriber).run()

        verify(subscriber).complete()
        verify(subscriber, never()).completeWithError(any())
        assertThat(service.isConnected(id)).isFalse()
        assertThat(service.stats().subscriptions).isEqualTo(1)
    }

    @Test
    fun `error callback completes with error and detaches`() {
        val service = service()
        val subscriber = service.subscribe()
        val id = establishedId(subscriber)
        val captor = argumentCaptor<Consumer<Throwable>>()
        verify(subscriber).onError(captor.capture())

        val failure = IOException("Broken pipe")
        captor.firstValue.accept(failure)

        verify(subscriber).completeWithError(failure)
        assertThat(service.isConnected(id)).isFalse()
    }

    @Test
    fun `late callback from a replaced emitter does not detach the new one`() {
        val service = service()
        val first = service.subscribe()
        val id = establishedId(first)
        val firstTimeout = timeoutCallback(first)
        service.subscribe(id)

        firstTimeout.run()

        assertThat(service.isConnected(id)).isTrue()
    }

    @Test
    fun `remove drops the subscription and completes its emitter`() {
        val service = service()
        val subscriber = service.subscribe()
        val id = establishedId(subscriber)

        service.remove(id)

        verify(subscriber).complete()
        assertThat(service.stats().subscriptions).isZero()
        assertDoesNotThrow { service.remove(UUID.randomUUID()) }
    }

    @Test
    fun `real subscriber tracks completion`() {
        val subscriber = Subscriber(1_000L)
        assertThat(subscriber.completed).isFalse()
        subscriber.complete()
        assertThat(subscriber.completed).isTrue()

        val errored = Subscriber(1_000L)
        errored.completeWithError(IOException("x"))
        assertThat(errored.completed).isTrue()
        assertThat(errored.timeout).isEqualTo(1_000L)
    }

    private fun timeoutCallback(subscriber: Subscriber): Runnable {
        val captor = argumentCaptor<Runnable>()
        verify(subscriber).onTimeout(captor.capture())
        return captor.firstValue
    }

    private fun completionCallback(subscriber: Subscriber): Runnable {
        val captor = argumentCaptor<Runnable>()
        verify(subscriber).onCompletion(captor.capture())
        return captor.firstValue
    }
}
