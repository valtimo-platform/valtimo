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

import com.ritense.valtimo.web.sse.event.BaseSseEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.io.IOException
import java.time.Clock
import java.time.Duration
import java.time.Instant

/**
 * One SSE subscription. Survives reconnects: while no [Subscriber] is attached, events are buffered
 * (bounded) and replayed on the next attach. All mutation is serialised on one lock; sends happen under it,
 * so a slow client only ever blocks its own subscription.
 */
class SubscriberHandler(
    val state: SubscriberState = SubscriberState(),
    private val maxQueuedEvents: Int = DEFAULT_MAX_QUEUED_EVENTS,
    private val clock: Clock = Clock.systemUTC(),
) {

    @Volatile
    var subscriber: Subscriber? = null
        private set

    @Volatile
    var disconnectedSince: Instant? = clock.instant()
        private set

    private val lock = Any()
    private val eventQueue = ArrayDeque<BaseSseEvent>()

    val isConnected: Boolean get() = subscriber != null

    val queuedEventCount: Int get() = synchronized(lock) { eventQueue.size }

    fun isDisconnectedLongerThan(gracePeriod: Duration, now: Instant = clock.instant()): Boolean {
        val since = disconnectedSince ?: return false
        return Duration.between(since, now) >= gracePeriod
    }

    /** Sends [event] now, or buffers it when no subscriber is attached. */
    fun enqueue(event: BaseSseEvent) = synchronized(lock) {
        val current = subscriber
        if (current != null) {
            when (trySend(current) { it.send(event) }) {
                SendResult.SENT, SendResult.UNSENDABLE -> return
                SendResult.DISCONNECTED -> Unit
            }
        }
        if (eventQueue.size >= maxQueuedEvents) {
            eventQueue.removeFirst()
            logger.debug { "Queue full for subscription ${state.subscriptionId}, dropped oldest event" }
        }
        eventQueue.addLast(event)
    }

    /** Attaches [subscriber] (or detaches on null) and replays buffered events in order. */
    fun setSubscriber(subscriber: Subscriber?) = synchronized(lock) {
        this.subscriber = subscriber
        disconnectedSince = if (subscriber == null) clock.instant() else null
        if (subscriber == null) return
        while (eventQueue.isNotEmpty() && this.subscriber === subscriber) {
            when (trySend(subscriber) { it.send(eventQueue.first()) }) {
                SendResult.SENT, SendResult.UNSENDABLE -> eventQueue.removeFirst()
                SendResult.DISCONNECTED -> break
            }
        }
    }

    /** Detaches only if [subscriber] is still the attached one. Safe for late timeout/error/completion callbacks. */
    fun detach(subscriber: Subscriber) = synchronized(lock) {
        markDisconnected(subscriber)
    }

    /** Sends a keep-alive comment. Returns false when not connected or the client turned out to be gone. */
    fun heartbeat(): Boolean = synchronized(lock) {
        val current = subscriber ?: return false
        trySend(current) { it.send(SseEmitter.event().comment("keep-alive")) } == SendResult.SENT
    }

    private fun trySend(subscriber: Subscriber, send: (Subscriber) -> Unit): SendResult {
        return try {
            send(subscriber)
            SendResult.SENT
        } catch (e: IOException) {
            logger.debug { "Subscription ${state.subscriptionId} lost its client: ${e.message}" }
            markDisconnected(subscriber)
            SendResult.DISCONNECTED
        } catch (e: IllegalStateException) {
            if (subscriber.completed) {
                logger.debug { "Subscription ${state.subscriptionId} emitter already completed" }
                markDisconnected(subscriber)
                SendResult.DISCONNECTED
            } else {
                logger.error(e) { "Dropping unsendable SSE event for subscription ${state.subscriptionId}" }
                SendResult.UNSENDABLE
            }
        }
    }

    private fun markDisconnected(subscriber: Subscriber) {
        if (this.subscriber === subscriber) {
            this.subscriber = null
            disconnectedSince = clock.instant()
        }
    }

    private enum class SendResult { SENT, DISCONNECTED, UNSENDABLE }

    companion object {
        const val DEFAULT_MAX_QUEUED_EVENTS = 100
        private val logger = KotlinLogging.logger {}
    }
}
