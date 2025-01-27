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

package com.ritense.objectenapi

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.objectenapi.client.ObjectRecord
import com.ritense.objectenapi.client.ObjectRequest
import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectenapi.client.ObjectenApiClient
import com.ritense.objectenapi.client.dto.TypedObjectRecord
import com.ritense.objectenapi.client.dto.TypedObjectWrapper
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import java.net.URI
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals

internal class ObjectenApiPluginTest {

    val client = mock<ObjectenApiClient>()
    val plugin = ObjectenApiPlugin(client)

    @BeforeEach
    fun setUp() {
        plugin.authenticationPluginConfiguration = mock()
        plugin.url = URI("http://example.com")
    }

    @Test
    fun `should call client on get object`() {
        val objectWrapper = createTypedObjectWrapper()
        whenever(client.getObject(plugin.authenticationPluginConfiguration, objectWrapper.url, JsonNode::class.java)).thenReturn(objectWrapper)

        val result = plugin.getObject(objectWrapper.url)

        assertEquals(ObjectWrapper.fromTyped(objectWrapper), result)
        verify(client).getObject(any(), any(), eq(JsonNode::class.java))
    }

    @Test
    fun `should call client on update object`() {
        val objectWrapper = createTypedObjectWrapper()
        val objectRequest = createObjectRequest()

        whenever(client.objectUpdate(plugin.authenticationPluginConfiguration, objectWrapper.url, ObjectRequest.toTyped(objectRequest), JsonNode::class.java))
            .thenReturn(objectWrapper)

        val result = plugin.objectUpdate(objectWrapper.url, objectRequest)

        assertEquals(ObjectWrapper.fromTyped(objectWrapper), result)
        verify(client).objectUpdate(any(), any(), any(), eq(JsonNode::class.java))
    }

    @Test
    fun `should call client on patch object`() {
        val objectWrapper = createTypedObjectWrapper()
        val objectRequest = createObjectRequest()
        whenever(
            client.objectPatch(
                plugin.authenticationPluginConfiguration,
                objectWrapper.url,
                ObjectRequest.toTyped(objectRequest),
                JsonNode::class.java
            )
        ).thenReturn(objectWrapper)

        val result = plugin.objectPatch(objectWrapper.url, objectRequest)

        assertEquals(ObjectWrapper.fromTyped(objectWrapper), result)
        verify(client).objectPatch(any(), any(), any(), eq(JsonNode::class.java))
    }

    @Test
    fun `should call client on delete object`() {
        val objectUrl = URI("http://example.com/1")
        val mockStatus = mock<HttpStatus>()
        whenever(client.deleteObject(plugin.authenticationPluginConfiguration, objectUrl)).thenReturn(mockStatus)

        val result = plugin.deleteObject(objectUrl)

        assertEquals(mockStatus, result)
        verify(client).deleteObject(any(), any())
    }

    @Test
    fun `should fail on delete object due to url mismatch`() {
        val objectUrl = URI("http://localhost/1")

        assertThrows<IllegalStateException> {
            plugin.deleteObject(objectUrl)
        }

        verify(client, never()).deleteObject(any(), any())
    }

    private fun createObjectRequest(): ObjectRequest {
        return ObjectRequest(
            type = URI("http://example.com/type/1"),
            record = ObjectRecord.ofTyped(createTypedObjectRecord())
        )
    }

    private fun createTypedObjectWrapper(): TypedObjectWrapper<JsonNode> {
        return TypedObjectWrapper(
            url = URI("http://example.com/object/1"),
            uuid = UUID.randomUUID(),
            type = URI("http://example.com/type/1"),
            record = createTypedObjectRecord()
        )
    }

    private fun createTypedObjectRecord() = TypedObjectRecord(
        typeVersion = 1,
        startAt = LocalDate.now(),
        data = jacksonObjectMapper().readTree(
            """
                {
                    "test": "yes"
                }
            """.trimIndent()
        )
    )
}