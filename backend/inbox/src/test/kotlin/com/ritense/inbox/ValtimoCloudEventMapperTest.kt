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

package com.ritense.inbox

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import io.cloudevents.CloudEvent
import io.cloudevents.core.builder.CloudEventBuilder
import io.cloudevents.core.provider.EventFormatProvider
import io.cloudevents.jackson.JsonFormat
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.net.URI
import java.time.OffsetDateTime
import java.util.UUID

class ValtimoCloudEventMapperTest {

    private val objectMapper = jacksonObjectMapper()
    private val cloudEventMapper = ValtimoCloudEventMapper(objectMapper)
    private val cloudEventFormat = EventFormatProvider
        .getInstance()
        .resolveFormat(JsonFormat.CONTENT_TYPE)!!

    @Test
    fun `should convert cloudevent json payload to valtimo event`() {
        val cloudEvent = createCloudEvent(createCloudEventData())
        val serialized = String(cloudEventFormat.serialize(cloudEvent), Charsets.UTF_8)

        val deserializedCloudEvent = cloudEventMapper.fromJson(serialized)
        assertThat(deserializedCloudEvent).isNotNull

        val valtimoEvent = cloudEventMapper.toValtimoEvent(deserializedCloudEvent!!)
        assertThat(valtimoEvent).isNotNull
        assertThat(valtimoEvent!!.id).isEqualTo(cloudEvent.id)
        assertThat(valtimoEvent.userId).isEqualTo("john.doe")
        assertThat(valtimoEvent.roles).containsExactlyInAnyOrder("ADMIN", "USER")
        assertThat(valtimoEvent.resultType).isEqualTo("document")
    }

    @Test
    fun `should return null when payload cannot be deserialized`() {
        val invalidPayload = "{\"invalid\""

        val deserializedCloudEvent = cloudEventMapper.fromJson(invalidPayload)

        assertThat(deserializedCloudEvent).isNull()
    }

    @Test
    fun `should return null when cloud event data cannot be converted`() {
        val cloudEvent = createCloudEvent("not-json".toByteArray())

        val valtimoEvent = cloudEventMapper.toValtimoEvent(cloudEvent)

        assertThat(valtimoEvent).isNull()
    }

    private fun createCloudEventData(): ByteArray {
        val data = CloudEventData(
            userId = "john.doe",
            roles = setOf("ADMIN", "USER"),
            resultType = "document",
            resultId = "123",
            result = objectMapper.createObjectNode().put("key", "value")
        )
        return objectMapper.writeValueAsBytes(data)
    }

    private fun createCloudEvent(data: ByteArray): CloudEvent {
        return CloudEventBuilder.v1()
            .withId(UUID.randomUUID().toString())
            .withSource(URI.create("application"))
            .withType("demo.event")
            .withTime(OffsetDateTime.now())
            .withDataContentType("application/json")
            .withData(data)
            .build()
    }
}
