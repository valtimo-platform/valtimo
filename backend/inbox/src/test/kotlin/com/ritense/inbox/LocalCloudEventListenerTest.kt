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
import io.cloudevents.core.builder.CloudEventBuilder
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import java.net.URI
import java.time.OffsetDateTime
import java.util.UUID

class LocalCloudEventListenerTest {

    private val objectMapper = jacksonObjectMapper()
    private val cloudEventMapper = ValtimoCloudEventMapper(objectMapper)
    private val handlerOne = mock<ValtimoEventHandler>()
    private val handlerTwo = mock<ValtimoEventHandler>()
    private val listener = LocalCloudEventListener(listOf(handlerOne, handlerTwo), cloudEventMapper)

    @Test
    fun `should dispatch mapped valtimo event to handlers`() {
        val data = objectMapper.writeValueAsBytes(
            CloudEventData(
                userId = "john.doe",
                roles = setOf("ADMIN"),
                resultType = "document",
                resultId = "123",
                result = objectMapper.createObjectNode()
            )
        )
        val cloudEvent = CloudEventBuilder.v1()
            .withId(UUID.randomUUID().toString())
            .withSource(URI.create("application"))
            .withType("demo.event")
            .withTime(OffsetDateTime.now())
            .withDataContentType("application/json")
            .withData(data)
            .build()

        listener.handle(cloudEvent)

        val captor = argumentCaptor<ValtimoEvent>()
        verify(handlerOne).handle(captor.capture())
        assertThat(captor.firstValue.type).isEqualTo("demo.event")
        verify(handlerTwo).handle(captor.firstValue)
    }

    @Test
    fun `should ignore event when data cannot be mapped`() {
        val cloudEvent = CloudEventBuilder.v1()
            .withId(UUID.randomUUID().toString())
            .withSource(URI.create("application"))
            .withType("demo.event")
            .withTime(OffsetDateTime.now())
            .withDataContentType("application/json")
            .withData("not-json".toByteArray())
            .build()

        listener.handle(cloudEvent)

        verify(handlerOne, never()).handle(any())
        verify(handlerTwo, never()).handle(any())
    }
}
