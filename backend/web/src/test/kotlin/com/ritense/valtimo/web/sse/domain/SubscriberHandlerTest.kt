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

package com.ritense.valtimo.web.sse.domain

import com.ritense.valtimo.web.sse.MutableClock
import com.ritense.valtimo.web.sse.TestSseEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.io.IOException
import java.time.Duration
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class SubscriberHandlerTest {

    private val clock = MutableClock()

    private fun recordingSubscriber(sent: MutableList<Any>): Subscriber {
        val subscriber = mock<Subscriber>()
        doAnswer { sent += it.getArgument<Any>(0); null }.whenever(subscriber).send(any<Any>())
        return subscriber
    }

    private fun seqs(sent: List<Any>) = sent.filterIsInstance<TestSseEvent>().map { it.seq }

    @Test
    fun `new handler counts as disconnected since creation`() {
        val handler = SubscriberHandler(clock = clock)

        assertThat(handler.isConnected).isFalse()
        assertThat(handler.disconnectedSince).isEqualTo(clock.instant())
        clock.advance(Duration.ofMinutes(3))
        assertThat(handler.isDisconnectedLongerThan(Duration.ofMinutes(2))).isTrue()
    }

    @Test
    fun `sends directly when connected`() {
        val sent = mutableListOf<Any>()
        val handler = SubscriberHandler(clock = clock)
        handler.setSubscriber(recordingSubscriber(sent))

        handler.enqueue(TestSseEvent(1))
        handler.enqueue(TestSseEvent(2))

        assertThat(seqs(sent)).containsExactly(1, 2)
        assertThat(handler.queuedEventCount).isZero()
        assertThat(handler.disconnectedSince).isNull()
        assertThat(handler.isDisconnectedLongerThan(Duration.ZERO)).isFalse()
    }

    @Test
    fun `queues while disconnected and replays in order on attach`() {
        val handler = SubscriberHandler(clock = clock)
        (1..5).forEach { handler.enqueue(TestSseEvent(it)) }
        assertThat(handler.queuedEventCount).isEqualTo(5)

        val sent = mutableListOf<Any>()
        handler.setSubscriber(recordingSubscriber(sent))

        assertThat(seqs(sent)).containsExactly(1, 2, 3, 4, 5)
        assertThat(handler.queuedEventCount).isZero()
    }

    @Test
    fun `queue is bounded and drops the oldest events`() {
        val handler = SubscriberHandler(maxQueuedEvents = 3, clock = clock)
        (1..10).forEach { handler.enqueue(TestSseEvent(it)) }
        assertThat(handler.queuedEventCount).isEqualTo(3)

        val sent = mutableListOf<Any>()
        handler.setSubscriber(recordingSubscriber(sent))

        assertThat(seqs(sent)).containsExactly(8, 9, 10)
    }

    @Test
    fun `io failure on send detaches the subscriber and queues the event`() {
        val subscriber = mock<Subscriber>()
        doThrow(IOException("Broken pipe")).whenever(subscriber).send(any<Any>())
        val handler = SubscriberHandler(clock = clock)
        handler.setSubscriber(subscriber)
        clock.advance(Duration.ofSeconds(10))

        handler.enqueue(TestSseEvent(1))

        assertThat(handler.isConnected).isFalse()
        assertThat(handler.disconnectedSince).isEqualTo(clock.instant())
        assertThat(handler.queuedEventCount).isEqualTo(1)
        verify(subscriber, never()).complete()
    }

    @Test
    fun `illegal state on a completed subscriber is treated as disconnect`() {
        val subscriber = mock<Subscriber>()
        whenever(subscriber.completed).thenReturn(true)
        doThrow(IllegalStateException("ResponseBodyEmitter has already completed")).whenever(subscriber).send(any<Any>())
        val handler = SubscriberHandler(clock = clock)
        handler.setSubscriber(subscriber)

        handler.enqueue(TestSseEvent(1))

        assertThat(handler.isConnected).isFalse()
        assertThat(handler.queuedEventCount).isEqualTo(1)
    }

    @Test
    fun `illegal state on a live subscriber drops that event and keeps the subscriber`() {
        val sent = mutableListOf<Any>()
        val subscriber = recordingSubscriber(sent)
        val poison = TestSseEvent(99)
        doThrow(IllegalStateException("Failed to send")).whenever(subscriber).send(poison)
        val handler = SubscriberHandler(clock = clock)
        handler.setSubscriber(subscriber)

        handler.enqueue(TestSseEvent(1))
        handler.enqueue(poison)
        handler.enqueue(TestSseEvent(2))

        assertThat(handler.isConnected).isTrue()
        assertThat(handler.queuedEventCount).isZero()
        assertThat(seqs(sent)).containsExactly(1, 2)
    }

    @Test
    fun `replay stops at the first io failure and keeps remaining events`() {
        val handler = SubscriberHandler(clock = clock)
        (1..4).forEach { handler.enqueue(TestSseEvent(it)) }
        val sent = mutableListOf<Any>()
        val subscriber = recordingSubscriber(sent)
        doThrow(IOException("Broken pipe")).whenever(subscriber).send(argThatSeq(3))

        handler.setSubscriber(subscriber)

        assertThat(seqs(sent)).containsExactly(1, 2)
        assertThat(handler.isConnected).isFalse()
        assertThat(handler.queuedEventCount).isEqualTo(2)

        val replay = mutableListOf<Any>()
        handler.setSubscriber(recordingSubscriber(replay))
        assertThat(seqs(replay)).containsExactly(3, 4)
    }

    @Test
    fun `replay skips unsendable events on a live subscriber`() {
        val handler = SubscriberHandler(clock = clock)
        (1..3).forEach { handler.enqueue(TestSseEvent(it)) }
        val sent = mutableListOf<Any>()
        val subscriber = recordingSubscriber(sent)
        doThrow(IllegalStateException("Failed to send")).whenever(subscriber).send(argThatSeq(2))

        handler.setSubscriber(subscriber)

        assertThat(seqs(sent)).containsExactly(1, 3)
        assertThat(handler.isConnected).isTrue()
        assertThat(handler.queuedEventCount).isZero()
    }

    @Test
    fun `detach only clears the matching subscriber`() {
        val handler = SubscriberHandler(clock = clock)
        val old = recordingSubscriber(mutableListOf())
        val current = recordingSubscriber(mutableListOf())
        handler.setSubscriber(old)
        handler.setSubscriber(current)

        handler.detach(old)
        assertThat(handler.subscriber).isSameAs(current)

        handler.detach(current)
        assertThat(handler.isConnected).isFalse()
        assertThat(handler.disconnectedSince).isEqualTo(clock.instant())
    }

    @Test
    fun `heartbeat sends a comment to a connected subscriber`() {
        val subscriber = mock<Subscriber>()
        val handler = SubscriberHandler(clock = clock)
        handler.setSubscriber(subscriber)

        assertThat(handler.heartbeat()).isTrue()

        verify(subscriber).send(any<SseEmitter.SseEventBuilder>())
        verify(subscriber, never()).send(any<Any>())
    }

    @Test
    fun `heartbeat returns false when disconnected and detaches a gone client`() {
        val handler = SubscriberHandler(clock = clock)
        assertThat(handler.heartbeat()).isFalse()

        val subscriber = mock<Subscriber>()
        doThrow(IOException("Connection reset by peer")).whenever(subscriber).send(any<SseEmitter.SseEventBuilder>())
        handler.setSubscriber(subscriber)

        assertThat(handler.heartbeat()).isFalse()
        assertThat(handler.isConnected).isFalse()
    }

    @Test
    fun `attaching a subscriber does not send anything when the queue is empty`() {
        val subscriber = mock<Subscriber>()
        SubscriberHandler(clock = clock).setSubscriber(subscriber)

        verify(subscriber, never()).send(any<Any>())
        verify(subscriber, times(0)).send(any<SseEmitter.SseEventBuilder>())
    }

    @Test
    fun `concurrent enqueue and reconnect is safe and never grows beyond the bound`() {
        val maxQueued = 50
        val handler = SubscriberHandler(maxQueuedEvents = maxQueued, clock = clock)
        val delivered = AtomicInteger()
        val subscriber = mock<Subscriber>()
        doAnswer { delivered.incrementAndGet(); null }.whenever(subscriber).send(any<Any>())
        val errors = CopyOnWriteArrayList<Throwable>()
        val producers = 8
        val perProducer = 5_000
        val pool = Executors.newFixedThreadPool(producers + 2)

        val tasks = (1..producers).map {
            pool.submit {
                repeat(perProducer) { seq ->
                    try {
                        handler.enqueue(TestSseEvent(seq))
                        if (handler.queuedEventCount > maxQueued) errors += AssertionError("queue over bound")
                    } catch (t: Throwable) {
                        errors += t
                    }
                }
            }
        } + pool.submit {
            repeat(2_000) {
                handler.setSubscriber(subscriber)
                handler.setSubscriber(null)
            }
        } + pool.submit {
            repeat(2_000) { handler.heartbeat() }
        }
        tasks.forEach { it.get(60, TimeUnit.SECONDS) }
        pool.shutdownNow()

        handler.setSubscriber(subscriber)
        assertThat(errors).isEmpty()
        assertThat(handler.queuedEventCount).isZero()
        assertThat(delivered.get()).isGreaterThan(0).isLessThanOrEqualTo(producers * perProducer)
    }

    private fun argThatSeq(seq: Int): Any = org.mockito.kotlin.argThat<Any> { (this as? TestSseEvent)?.seq == seq }
}
