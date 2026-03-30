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

package com.ritense.outbox

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.outbox.domain.BaseEvent
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class CloudEventFactoryTest {

    private val objectMapper = jacksonObjectMapper()

    @Test
    fun `should create CloudEvent with correct spec version and type`() {
        val userProvider = mock<UserProvider>()
        val factory = CloudEventFactory(objectMapper, userProvider, "test-app")

        val event = object : BaseEvent(
            type = "com.example.test",
            resultType = "Order",
            resultId = "123",
            result = null
        ) {}

        val cloudEvent = factory.create(event)

        assertThat(cloudEvent.specVersion.toString()).isEqualTo("1.0")
        assertThat(cloudEvent.type).isEqualTo("com.example.test")
        assertThat(cloudEvent.source.toString()).isEqualTo("test-app")
        assertThat(cloudEvent.id).isEqualTo(event.id.toString())
        assertThat(cloudEvent.dataContentType).isEqualTo("application/json")
    }

    @Test
    fun `should use event userId when provided`() {
        val userProvider = mock<UserProvider>()
        whenever(userProvider.getCurrentUserLogin()).thenReturn("other-user")
        val factory = CloudEventFactory(objectMapper, userProvider, "test-app")

        val event = object : BaseEvent(
            type = "test",
            userId = "event-user",
            resultType = null,
            resultId = null,
            result = null
        ) {}

        val cloudEvent = factory.create(event)
        val data = objectMapper.readTree(cloudEvent.data!!.toBytes())

        assertThat(data["userId"].textValue()).isEqualTo("event-user")
    }

    @Test
    fun `should fall back to UserProvider when event userId is null`() {
        val userProvider = mock<UserProvider>()
        whenever(userProvider.getCurrentUserLogin()).thenReturn("provider-user")
        whenever(userProvider.getCurrentUserRoles()).thenReturn(listOf("ROLE_ADMIN"))
        val factory = CloudEventFactory(objectMapper, userProvider, "test-app")

        val event = object : BaseEvent(
            type = "test",
            resultType = null,
            resultId = null,
            result = null
        ) {}

        val cloudEvent = factory.create(event)
        val data = objectMapper.readTree(cloudEvent.data!!.toBytes())

        assertThat(data["userId"].textValue()).isEqualTo("provider-user")
        assertThat(data["roles"].map { it.textValue() }).containsExactly("ROLE_ADMIN")
    }

    @Test
    fun `should use System as userId when no user is available`() {
        val userProvider = mock<UserProvider>()
        whenever(userProvider.getCurrentUserLogin()).thenReturn(null)
        whenever(userProvider.getCurrentUserRoles()).thenReturn(emptyList())
        val factory = CloudEventFactory(objectMapper, userProvider, "test-app")

        val event = object : BaseEvent(
            type = "test",
            resultType = null,
            resultId = null,
            result = null
        ) {}

        val cloudEvent = factory.create(event)
        val data = objectMapper.readTree(cloudEvent.data!!.toBytes())

        assertThat(data["userId"].textValue()).isEqualTo("System")
    }

    @Test
    fun `should use event roles when provided`() {
        val userProvider = mock<UserProvider>()
        whenever(userProvider.getCurrentUserRoles()).thenReturn(listOf("ROLE_FROM_PROVIDER"))
        val factory = CloudEventFactory(objectMapper, userProvider, "test-app")

        val event = object : BaseEvent(
            type = "test",
            roles = setOf("ROLE_FROM_EVENT"),
            resultType = null,
            resultId = null,
            result = null
        ) {}

        val cloudEvent = factory.create(event)
        val data = objectMapper.readTree(cloudEvent.data!!.toBytes())

        assertThat(data["roles"].map { it.textValue() }).containsExactly("ROLE_FROM_EVENT")
    }
}
