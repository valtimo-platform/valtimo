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

package com.ritense.outbox.rabbitmq

import com.ritense.outbox.OutboxMessage
import com.ritense.outbox.publisher.MessagePublishResult
import com.ritense.outbox.publisher.MessagePublisher
import com.ritense.outbox.publisher.MessagePublishingFailed
import mu.KLogger
import mu.KotlinLogging
import org.springframework.amqp.core.Message
import org.springframework.amqp.rabbit.connection.CorrelationData
import org.springframework.amqp.rabbit.core.RabbitTemplate
import java.time.Duration
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.CancellationException
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeoutException

class RabbitMessagePublisher(
    private val rabbitTemplate: RabbitTemplate,
    routingKey: String? = null,
    private val deliveryTimeout: Duration = Duration.ofSeconds(1),
    exchange: String? = null
) : MessagePublisher {

    private val exchange: String = exchange ?: run {
        logger.debug { "Using Rabbit template default exchange: ${rabbitTemplate.exchange}" }
        rabbitTemplate.exchange ?: ""
    }
    private val routingKey: String = routingKey ?: run {
        logger.debug { "Using Rabbit template default routingKey: ${rabbitTemplate.exchange}" }
        rabbitTemplate.routingKey ?: ""
    }

    init {
        require(rabbitTemplate.connectionFactory.isPublisherConfirms) { "The RabbitMQ outbox publisher requires correlated publisher-confirm-type!" }
        require(rabbitTemplate.connectionFactory.isPublisherReturns) { "The RabbitMQ outbox publisher requires publisher-returns to be enabled!" }
        require(rabbitTemplate.isMandatoryFor(Message("test".toByteArray()))) { "The RabbitMQ outbox publisher requires messages to be mandatory!" }
    }

    override fun publish(message: OutboxMessage) {
        val result = publishBatch(listOf(message)).first()
        if (!result.success) {
            throw result.error ?: MessagePublishingFailed("Failed to publish outbox message ${message.id}")
        }
    }

    /**
     * Pipelines message sends to RabbitMQ for improved throughput.
     *
     * Instead of send-wait-send-wait per message, this sends all messages first,
     * then waits for all publisher confirms in parallel. The deliveryTimeout applies
     * to the entire batch, not per message.
     *
     * Each message still gets its own CorrelationData and is individually verified,
     * so delivery guarantees are identical to calling [publish] per message.
     */
    override fun publishBatch(messages: List<OutboxMessage>): List<MessagePublishResult> {
        if (messages.isEmpty()) return emptyList()

        // Phase 1: send all messages without waiting for confirms
        val pending = messages.map { message ->
            val correlationData = CorrelationData(UUID.randomUUID().toString())
            logger.trace { "Sending message to RabbitMQ: routingKey=${routingKey}, msgId=${message.id}, correlationId=${correlationData.id}" }
            rabbitTemplate.convertAndSend(exchange, routingKey, message.message, correlationData)
            message to correlationData
        }

        // Phase 2: wait for all confirms in parallel with a single timeout for the entire batch
        val allFutures = pending.map { (_, correlationData) -> correlationData.future.toCompletableFuture() }
        try {
            CompletableFuture.allOf(*allFutures.toTypedArray())[deliveryTimeout.toMillis(), TimeUnit.MILLISECONDS]
        } catch (_: TimeoutException) {
            // Some futures may not have completed — handled per-message below
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            // Proceed to collect partial results — incomplete futures handled per-message below
        } catch (_: ExecutionException) {
            // Individual future failures handled per-message below
        }

        // Phase 3: collect results per message
        return pending.map { (message, correlationData) -> collectResult(message, correlationData) }
    }

    private fun collectResult(message: OutboxMessage, correlationData: CorrelationData): MessagePublishResult {
        val ctx = "routingKey=$routingKey, msgId=${message.id}, correlationId=${correlationData.id}"

        fun failure(reason: String) = MessagePublishResult(
            messageId = message.id,
            success = false,
            error = MessagePublishingFailed("$reason: $ctx")
        )

        val future = correlationData.future.toCompletableFuture()
        if (!future.isDone) {
            return failure("Outbox message delivery was not confirmed in time")
        }

        val result = try {
            future.get()
        } catch (e: ExecutionException) {
            return failure("Confirmation future failed, cause=${e.cause?.message ?: e.message}")
        } catch (_: CancellationException) {
            return failure("Confirmation future was cancelled")
        } ?: return failure("Outbox message confirmation result was null")

        if (!result.isAck) {
            return failure("Outbox message was not acknowledged, reason=${result.reason}")
        }

        val returned = correlationData.returned
        if (returned != null) {
            return failure("Could not deliver outbox message, returnedRoutingKey=${returned.routingKey}, code=${returned.replyCode}, msg=${returned.replyText}")
        }

        return MessagePublishResult(messageId = message.id, success = true)
    }

    companion object {
        private val logger: KLogger = KotlinLogging.logger {}
    }
}
