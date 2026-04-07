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

package com.ritense.outbox.publisher

import com.ritense.outbox.OutboxMessage

interface MessagePublisher {

    fun publish(message: OutboxMessage)

    /**
     * Publishes a batch of messages and returns a per-message result.
     *
     * The default implementation delegates to [publish] for each message individually,
     * catching exceptions per message so that one failure does not prevent the rest from being published.
     *
     * Batch-capable publishers (e.g. using RabbitMQ batch sends) can override this
     * to publish multiple messages in a single network round-trip.
     */
    fun publishBatch(messages: List<OutboxMessage>): List<MessagePublishResult> {
        return messages.map { message ->
            try {
                publish(message)
                MessagePublishResult(messageId = message.id, success = true)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
                MessagePublishResult(messageId = message.id, success = false, error = e)
            } catch (e: Exception) {
                MessagePublishResult(messageId = message.id, success = false, error = e)
            }
        }
    }
}
