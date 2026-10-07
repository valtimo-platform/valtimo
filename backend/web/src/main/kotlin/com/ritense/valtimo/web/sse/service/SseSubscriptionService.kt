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

import com.ritense.valtimo.web.sse.config.SseProperties
import com.ritense.valtimo.web.sse.domain.Subscriber
import com.ritense.valtimo.web.sse.domain.SubscriberHandler
import com.ritense.valtimo.web.sse.event.BaseSseEvent
import com.ritense.valtimo.web.sse.event.EstablishedConnectionSseEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.annotation.PostConstruct
import jakarta.annotation.PreDestroy
import java.time.Clock
import java.time.Duration
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executor
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/**
 * Keeps all SSE subscriptions and broadcasts events to them.
 *
 * Sending happens on a single dedicated thread, never on the caller's (business) thread. A periodic
 * maintenance tick sends heartbeats and evicts subscriptions that stayed disconnected beyond the grace period.
 */
class SseSubscriptionService(
    private val properties: SseProperties = SseProperties(),
    private val clock: Clock = Clock.systemUTC(),
    sender: Executor? = null,
    private val subscriberFactory: (timeoutMillis: Long) -> Subscriber = { Subscriber(it) },
) {

    private val handlers = ConcurrentHashMap<UUID, SubscriberHandler>()
    private val ownsSender = sender == null
    private val sender: Executor = sender ?: newSender(properties.maxPendingNotifications)
    private var scheduler: ScheduledExecutorService? = null

    @PostConstruct
    fun start() {
        if (scheduler != null) return
        val tick = properties.heartbeatInterval.takeIf { it > Duration.ZERO } ?: DEFAULT_MAINTENANCE_INTERVAL
        scheduler = Executors.newSingleThreadScheduledExecutor { daemonThread(it, "sse-maintenance") }.also {
            it.scheduleAtFixedRate({ submit(::runMaintenance) }, tick.toMillis(), tick.toMillis(), TimeUnit.MILLISECONDS)
        }
    }

    @PreDestroy
    fun stop() {
        scheduler?.shutdownNow()
        scheduler = null
        if (ownsSender) (sender as? ExecutorService)?.shutdownNow()
        handlers.values.forEach { handle -> handle.subscriber?.let { runCatching { it.complete() } } }
        handlers.clear()
    }

    fun subscribe(subscriptionId: UUID? = null): Subscriber {
        var reconnected: Subscriber? = null
        if (subscriptionId != null) {
            // compute keeps the reconnect atomic w.r.t. eviction of the same id
            handlers.computeIfPresent(subscriptionId) { _, handle ->
                logger.debug { "Reconnecting subscription $subscriptionId" }
                reconnected = connect(handle)
                handle
            }
        }
        return reconnected ?: registerNewSubscriber()
    }

    fun remove(subscriptionId: UUID) {
        handlers.remove(subscriptionId)?.subscriber?.let { runCatching { it.complete() } }
    }

    fun notifySubscribers(event: BaseSseEvent) {
        submit { broadcast(event) }
    }

    fun stats(): SseSubscriptionStats {
        val handles = handlers.values.toList()
        return SseSubscriptionStats(
            subscriptions = handles.size,
            connected = handles.count { it.isConnected },
            queuedEvents = handles.sumOf { it.queuedEventCount },
        )
    }

    fun hasSubscription(subscriptionId: UUID): Boolean = handlers.containsKey(subscriptionId)

    fun queuedEventCount(subscriptionId: UUID): Int = handlers[subscriptionId]?.queuedEventCount ?: 0

    fun isConnected(subscriptionId: UUID): Boolean = handlers[subscriptionId]?.isConnected ?: false

    /** Heartbeats connected subscriptions, evicts ones disconnected beyond the grace period. Runs on the sender thread. */
    fun runMaintenance() {
        val heartbeatEnabled = properties.heartbeatInterval > Duration.ZERO
        if (heartbeatEnabled) {
            handlers.values.forEach { it.heartbeat() }
        }
        val now = clock.instant()
        for (id in handlers.keys) {
            handlers.computeIfPresent(id) { _, handle ->
                if (handle.isDisconnectedLongerThan(properties.reconnectGracePeriod, now)) {
                    logger.debug { "Evicting subscription $id, disconnected since ${handle.disconnectedSince}" }
                    null
                } else {
                    handle
                }
            }
        }
    }

    private fun broadcast(event: BaseSseEvent) {
        logger.debug { "Notify subscribers (total=${handlers.size})" }
        handlers.forEach { (id, handle) ->
            try {
                handle.enqueue(event)
            } catch (e: Exception) {
                logger.error(e) { "Removing SSE subscription $id after unexpected failure" }
                handlers.remove(id)
                handle.subscriber?.let { runCatching { it.completeWithError(e) } }
            }
        }
    }

    private fun registerNewSubscriber(): Subscriber {
        val handle = SubscriberHandler(maxQueuedEvents = properties.maxQueuedEvents, clock = clock)
        val subscriber = connect(handle)
        // established event first, then expose to broadcasts
        handle.enqueue(EstablishedConnectionSseEvent(handle.state.subscriptionId))
        handlers[handle.state.subscriptionId] = handle
        logger.debug { "Registered subscription ${handle.state.subscriptionId}" }
        return subscriber
    }

    private fun connect(handle: SubscriberHandler): Subscriber {
        val previous = handle.subscriber
        val subscriber = subscriberFactory(properties.connectionTimeout.toMillis())
        subscriber.onTimeout {
            logger.debug { "Subscription ${handle.state.subscriptionId} timed out, client will reconnect" }
            // complete() ends the stream with 200 so EventSource reconnects; a timeout error would stop it
            subscriber.complete()
            handle.detach(subscriber)
        }
        subscriber.onError {
            logger.debug { "Subscription ${handle.state.subscriptionId} errored: ${it.message}" }
            subscriber.completeWithError(it)
            handle.detach(subscriber)
        }
        subscriber.onCompletion { handle.detach(subscriber) }
        handle.setSubscriber(subscriber)
        previous?.let { runCatching { it.complete() } }
        return subscriber
    }

    private fun submit(task: () -> Unit) {
        try {
            sender.execute(task)
        } catch (e: RejectedExecutionException) {
            logger.warn { "SSE sender saturated, dropping notification: ${e.message}" }
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private val DEFAULT_MAINTENANCE_INTERVAL: Duration = Duration.ofSeconds(10)

        private fun newSender(maxPending: Int): ExecutorService = ThreadPoolExecutor(
            1, 1, 0L, TimeUnit.MILLISECONDS,
            LinkedBlockingQueue(maxPending),
            { daemonThread(it, "sse-sender") },
            ThreadPoolExecutor.AbortPolicy(),
        )

        private fun daemonThread(runnable: Runnable, name: String) = Thread(runnable, name).apply { isDaemon = true }
    }
}

data class SseSubscriptionStats(
    val subscriptions: Int,
    val connected: Int,
    val queuedEvents: Int,
)
