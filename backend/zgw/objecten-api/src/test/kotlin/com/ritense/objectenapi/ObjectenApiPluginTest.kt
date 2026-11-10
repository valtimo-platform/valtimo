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

import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.ritense.objectenapi.client.ObjectRecord
import com.ritense.objectenapi.client.ObjectRequest
import com.ritense.objectenapi.client.ObjectWrapper
import com.ritense.objectenapi.client.ObjectenApiClient
import com.ritense.objectenapi.exception.ObjectUrlNotAllowedException
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import java.net.URI
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

internal class ObjectenApiPluginTest{

    val client = mock<ObjectenApiClient>()
    val plugin = ObjectenApiPlugin(client)

    @BeforeEach
    fun setUp() {
        plugin.authenticationPluginConfiguration = mock()
        plugin.url = URI("http://example.com")
    }

    @Test
    fun `should call client on get object`() {
        val objectUrl = URI("http://example.com/1")
        val objectMock = mock<ObjectWrapper>()
        whenever(client.getObject(plugin.authenticationPluginConfiguration, objectUrl)).thenReturn(objectMock)

        val result = plugin.getObject(objectUrl)

        assertEquals(objectMock, result)
        verify(client).getObject(any(), any())
    }

    @Test
    fun `should call client on getObjectRecord`() {
        val objectUrl = URI("http://example.com/1")
        val index = 1
        val recordMock = mock<ObjectRecord>()
        whenever(client.getObjectRecord(plugin.authenticationPluginConfiguration, objectUrl, index)).thenReturn(recordMock)

        val result = plugin.getObjectRecord(objectUrl, index)

        assertEquals(recordMock, result)
        verify(client).getObjectRecord(any(), any(), eq(index))
    }

    @Test
    fun `should call client on update object`() {
        val objectUrl =URI("http://example.com/1")
        val objectMock = mock<ObjectWrapper>()
        val objectRequest = mock<ObjectRequest>()
        whenever(client.objectUpdate(plugin.authenticationPluginConfiguration, objectUrl, objectRequest)).thenReturn(objectMock)

        val result = plugin.objectUpdate(objectUrl,  objectRequest)

        assertEquals(objectMock, result)
        verify(client).objectUpdate(any(), any(), any())
    }

    @Test
    fun `should call client on patch object`() {
        val objectUrl = URI("http://example.com/1")
        val objectMock = mock<ObjectWrapper>()
        val objectRequest = mock<ObjectRequest>()
        whenever(client.objectPatch(plugin.authenticationPluginConfiguration, objectUrl, objectRequest)).thenReturn(objectMock)

        val result = plugin.objectPatch(objectUrl,  objectRequest)

        assertEquals(objectMock, result)
        verify(client).objectPatch(any(), any(), any())
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

    @ParameterizedTest
    @ValueSource(
        strings = [
            "http://example.com:80/1",
            "HTTP://EXAMPLE.COM/1",
            "http://example.com",
            "http://example.com/objects/1?x=y",
        ]
    )
    fun `should accept object urls of the configured api`(objectUrl: String) {
        assertTrue(plugin.belongsToObjectenApi(URI(objectUrl)))
    }

    @ParameterizedTest
    @ValueSource(
        strings = [
            "http://other.com/1",
            "http://example.com.attacker.tld/1",
            "http://example.com@attacker.tld/1",
            "http://example.com:8080/1",
            "https://example.com/1",
            "http://user:pass@example.com/1",
            "mailto:someone@example.com",
        ]
    )
    fun `should reject object urls outside of the configured api`(objectUrl: String) {
        val uri = URI(objectUrl)
        val request = mock<ObjectRequest>()

        assertFalse(plugin.belongsToObjectenApi(uri))
        assertThrows<ObjectUrlNotAllowedException> { plugin.getObject(uri) }
        assertThrows<ObjectUrlNotAllowedException> { plugin.getObjectRecord(uri, 1) }
        assertThrows<ObjectUrlNotAllowedException> { plugin.objectUpdate(uri, request) }
        assertThrows<ObjectUrlNotAllowedException> { plugin.objectPatch(uri, request) }
        assertThrows<IllegalStateException> { plugin.deleteObject(uri) }
        verifyNoInteractions(client)
    }

    @Test
    fun `should reject lookalike host when configured url has no path`() {
        plugin.url = URI("http://objecten")

        assertThrows<ObjectUrlNotAllowedException> { plugin.objectUpdate(URI("http://objecten.attacker.tld/"), mock()) }
        assertThrows<ObjectUrlNotAllowedException> { plugin.objectUpdate(URI("http://objecten@attacker.tld/"), mock()) }
        assertThrows<IllegalStateException> { plugin.deleteObject(URI("http://objecten.attacker.tld/")) }
        verifyNoInteractions(client)
    }

    @Test
    fun `should accept object url with identical user info`() {
        plugin.url = URI("http://user@example.com/api")

        assertTrue(plugin.belongsToObjectenApi(URI("http://user@example.com/api/objects/1")))
        assertFalse(plugin.belongsToObjectenApi(URI("http://other@example.com/api/objects/1")))
    }

    @Test
    fun `should respect base path of configured url`() {
        plugin.url = URI("https://example.com/objecten/api/v2/")

        assertTrue(plugin.belongsToObjectenApi(URI("https://example.com:443/objecten/api/v2/objects/1")))
        assertTrue(plugin.belongsToObjectenApi(URI("https://example.com/objecten/api/v2")))
        assertFalse(plugin.belongsToObjectenApi(URI("https://example.com/objecten/api/v2-evil/objects/1")))
        assertFalse(plugin.belongsToObjectenApi(URI("https://example.com/other/objects/1")))
        assertFalse(plugin.belongsToObjectenApi(URI("https://example.com/objecten/api/v2/../v3/objects/1")))
        assertFalse(plugin.belongsToObjectenApi(URI("https://example.com/objecten/api/v2/%2e%2e/v3/objects/1")))
        assertFalse(plugin.belongsToObjectenApi(URI("https://example.com/objecten/api/v2/objects/../../../x")))
    }

    @Test
    fun `should not call client when object url traverses out of base path`() {
        plugin.url = URI("http://example.com/api/v2")
        val objectUrl = URI("http://example.com/api/v2/../v3/objects/1")

        assertThrows<ObjectUrlNotAllowedException> { plugin.getObject(objectUrl) }
        verifyNoInteractions(client)
    }

    @Test
    fun `should find configuration only for urls of the configured api`() {
        val properties = JsonNodeFactory.instance.objectNode().put(ObjectenApiPlugin.URL_PROPERTY, "http://objecten")

        assertTrue(ObjectenApiPlugin.findConfigurationByUrl(URI("http://objecten/api/v2/objects/1"))(properties))
        assertFalse(ObjectenApiPlugin.findConfigurationByUrl(URI("http://objecten.attacker.tld/"))(properties))
        assertFalse(ObjectenApiPlugin.findConfigurationByUrl(URI("http://objecten@attacker.tld/"))(properties))
    }

    @Test
    fun `should not find configuration when configured url is missing`() {
        val properties = JsonNodeFactory.instance.objectNode()

        assertFalse(ObjectenApiPlugin.findConfigurationByUrl(URI("http://example.com/1"))(properties))
    }

    @Test
    fun `should reject relative and opaque object urls`() {
        val base = URI("http://example.com")

        assertFalse(ObjectenApiPlugin.isUrlOfObjectenApi(base, URI("/relative/1")))
        assertFalse(ObjectenApiPlugin.isUrlOfObjectenApi(base, URI("mailto:a@b")))
        assertFalse(ObjectenApiPlugin.isUrlOfObjectenApi(URI("/relative"), URI("http://example.com/1")))
        assertFalse(ObjectenApiPlugin.isUrlOfObjectenApi(URI("mailto:a@b"), URI("http://example.com/1")))
    }

    @Test
    fun `should handle base url with trailing slash`() {
        val base = URI("http://example.com/")

        assertTrue(ObjectenApiPlugin.isUrlOfObjectenApi(base, URI("http://example.com/objects/1")))
        assertFalse(ObjectenApiPlugin.isUrlOfObjectenApi(base, URI("http://example.com.attacker.tld/objects/1")))
    }

    @Test
    fun `should not find configuration when configured url is malformed`() {
        val properties = JsonNodeFactory.instance.objectNode().put(ObjectenApiPlugin.URL_PROPERTY, "http://exa mple.com")

        assertFalse(ObjectenApiPlugin.findConfigurationByUrl(URI("http://example.com/1"))(properties))
    }
}
