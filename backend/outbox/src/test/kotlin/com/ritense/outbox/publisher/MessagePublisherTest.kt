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
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class MessagePublisherTest {

    @Test
    fun `publishBatch should call publish for each message and return success results`() {
        val published = mutableListOf<OutboxMessage>()
        val publisher = object : MessagePublisher {
            override fun publish(message: OutboxMessage) {
                published.add(message)
            }
        }
        val messages = listOf(
            OutboxMessage(message = "msg1"),
            OutboxMessage(message = "msg2"),
            OutboxMessage(message = "msg3")
        )

        val results = publisher.publishBatch(messages)

        assertThat(published).hasSize(3)
        assertThat(results).hasSize(3)
        assertThat(results).allMatch { it.success }
        assertThat(results.map { it.messageId }).containsExactlyElementsOf(messages.map { it.id })
    }

    @Test
    fun `publishBatch should capture individual failures without stopping the batch`() {
        val publisher = object : MessagePublisher {
            override fun publish(message: OutboxMessage) {
                if (message.message == "fail") {
                    throw RuntimeException("publish failed")
                }
            }
        }
        val messages = listOf(
            OutboxMessage(message = "ok1"),
            OutboxMessage(message = "fail"),
            OutboxMessage(message = "ok2")
        )

        val results = publisher.publishBatch(messages)

        assertThat(results).hasSize(3)
        assertThat(results[0].success).isTrue()
        assertThat(results[1].success).isFalse()
        assertThat(results[1].error).isInstanceOf(RuntimeException::class.java)
        assertThat(results[1].error!!.message).isEqualTo("publish failed")
        assertThat(results[2].success).isTrue()
    }

    @Test
    fun `publishBatch should return empty list for empty input`() {
        val publisher = object : MessagePublisher {
            override fun publish(message: OutboxMessage) {}
        }

        val results = publisher.publishBatch(emptyList())

        assertThat(results).isEmpty()
    }
}
