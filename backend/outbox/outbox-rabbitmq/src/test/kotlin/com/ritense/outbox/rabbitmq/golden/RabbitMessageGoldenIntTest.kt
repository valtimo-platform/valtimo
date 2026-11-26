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

package com.ritense.outbox.rabbitmq.golden

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.outbox.OutboxMessage
import com.ritense.outbox.rabbitmq.BaseIntegrationTest
import com.ritense.outbox.rabbitmq.RabbitMessagePublisher
import com.ritense.outbox.rabbitmq.config.RabbitOutboxConfigurationProperties
import com.ritense.valtimo.test.golden.GoldenJson
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.amqp.rabbit.core.RabbitAdmin
import org.springframework.amqp.rabbit.core.RabbitTemplate
import org.springframework.beans.factory.annotation.Autowired

class RabbitMessageGoldenIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var messagePublisher: RabbitMessagePublisher

    @Autowired
    lateinit var rabbitTemplate: RabbitTemplate

    @Autowired
    lateinit var rabbitAdmin: RabbitAdmin

    @Autowired
    lateinit var configurationProperties: RabbitOutboxConfigurationProperties

    private val mapper = ObjectMapper()

    @Test
    fun `the published message keeps its body and properties`() {
        val queue = checkNotNull(configurationProperties.routingKey)
        rabbitAdmin.purgeQueue(queue)

        messagePublisher.publish(OutboxMessage(message = CLOUD_EVENT))

        val received = checkNotNull(rabbitTemplate.receive(queue, 5000))
        assertThat(received.body).isEqualTo(CLOUD_EVENT.toByteArray(Charsets.UTF_8))
        val properties = received.messageProperties
        val envelope = mapper.createObjectNode()
            .put("contentType", properties.contentType)
            .put("contentEncoding", properties.contentEncoding)
            .put("deliveryMode", properties.deliveryMode?.name)
            .put("priority", properties.priority)
            .put("messageId", properties.messageId)
            .put("correlationId", properties.correlationId)
            .put("type", properties.type)
            .put("appId", properties.appId)
        envelope.set<JsonNode>("headers", mapper.valueToTree(properties.headers.toSortedMap()))
        envelope.set<JsonNode>("body", mapper.readTree(received.body))
        GoldenJson.assertMatchesGolden(javaClass, "message", mapper.writeValueAsString(envelope))
    }

    companion object {
        private val CLOUD_EVENT = """
            {"specversion":"1.0","id":"3f1c2c9e-1b7a-4b44-9d0c-2f6a3c7f0a11","source":"valtimo","type":"com.ritense.golden.created",
            "datacontenttype":"application/json","time":"2026-11-26T10:15:30.123+01:00",
            "data":{"userId":"golden-user","roles":["ROLE_USER"],"resultType":"com.ritense.Golden","resultId":"golden-1",
            "result":{"name":"Zoë Çelik ✓","amount":12.50,"nested":{"list":[1,"two",null]}}}}
        """.trimIndent().replace("\n", "")
    }
}
