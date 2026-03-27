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
import com.ritense.outbox.publisher.MessagePublishingFailed
import com.ritense.outbox.rabbitmq.config.RabbitOutboxConfigurationProperties
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.amqp.rabbit.core.RabbitAdmin
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.ActiveProfiles
import java.util.UUID

class RabbitMessagePublisherIntTest : BaseIntegrationTest() {
    @Nested
    inner class RoutingKey @Autowired constructor(
        val springCloudMessagePublisher: RabbitMessagePublisher,
        val rabbitTemplate: RabbitTemplate,
        val configurationProperties: RabbitOutboxConfigurationProperties,
        val rabbitAdmin: RabbitAdmin
    ) : BaseIntegrationTest() {
        @Test
        fun `should send message to rabbitmq queue`() {
            rabbitAdmin.purgeQueue(configurationProperties.routingKey!!)

            val uuid = UUID.randomUUID().toString()
            springCloudMessagePublisher.publish(
                OutboxMessage(message = uuid)
            )

            val msg = rabbitTemplate.receive(configurationProperties.routingKey!!)
            assertThat(msg!!.body.toString(Charsets.UTF_8)).isEqualTo(uuid)
        }

        @Test
        fun `should send batch of messages to rabbitmq queue`() {
            rabbitAdmin.purgeQueue(configurationProperties.routingKey!!)

            val uuid1 = UUID.randomUUID().toString()
            val uuid2 = UUID.randomUUID().toString()
            val results = springCloudMessagePublisher.publishBatch(
                listOf(
                    OutboxMessage(message = uuid1),
                    OutboxMessage(message = uuid2)
                )
            )

            assertThat(results).hasSize(2)
            assertThat(results).allMatch { it.success }

            val msg1 = rabbitTemplate.receive(configurationProperties.routingKey!!)
            val msg2 = rabbitTemplate.receive(configurationProperties.routingKey!!)
            val receivedMessages = setOf(
                msg1!!.body.toString(Charsets.UTF_8),
                msg2!!.body.toString(Charsets.UTF_8)
            )
            assertThat(receivedMessages).containsExactlyInAnyOrder(uuid1, uuid2)
        }
    }

    @Nested
    @ActiveProfiles("exchange")
    inner class Exchange @Autowired constructor(
        val messagePublisher: RabbitMessagePublisher,
        val rabbitTemplate: RabbitTemplate,
        val configurationProperties: RabbitOutboxConfigurationProperties,
        val rabbitAdmin: RabbitAdmin
    ) : BaseIntegrationTest() {
        @Test
        fun `should send message to rabbitmq queue via exchange`() {
            assertThat(configurationProperties.exchange).isNotEmpty()
            assertThat(configurationProperties.routingKey).isNullOrEmpty()

            rabbitAdmin.purgeQueue("valtimo-audit")

            val uuid = UUID.randomUUID().toString()
            messagePublisher.publish(
                OutboxMessage(message = uuid)
            )

            val msg = rabbitTemplate.receive("valtimo-audit")
            assertThat(msg!!.body.toString(Charsets.UTF_8)).isEqualTo(uuid)
        }
    }

    @Nested
    @ActiveProfiles("invalidrouting")
    inner class InvalidRouting @Autowired constructor(
        val messagePublisher: RabbitMessagePublisher
    ) : BaseIntegrationTest() {
        @Test
        fun `should not send message to rabbitmq`() {
            val uuid = UUID.randomUUID().toString()
            val ex = assertThrows<MessagePublishingFailed> {
                messagePublisher.publish(
                    OutboxMessage(message = uuid)
                )
            }

            assertThat(ex.message).contains("NO_ROUTE")
        }

        @Test
        fun `publishBatch should return failure for unroutable messages`() {
            val results = messagePublisher.publishBatch(
                listOf(
                    OutboxMessage(message = UUID.randomUUID().toString()),
                    OutboxMessage(message = UUID.randomUUID().toString())
                )
            )

            assertThat(results).hasSize(2)
            assertThat(results).allMatch { !it.success }
            assertThat(results).allMatch { it.error!!.message!!.contains("NO_ROUTE") }
        }
    }
}