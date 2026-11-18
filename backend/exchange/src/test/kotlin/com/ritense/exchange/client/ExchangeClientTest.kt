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

package com.ritense.exchange.client

import com.ritense.exchange.exception.ExchangeArtifactNotFoundException
import com.ritense.exchange.exception.ExchangeArtifactTooLargeException
import com.ritense.exchange.exception.ExchangeUnavailableException
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okio.Buffer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.web.client.RestClient
import java.time.Duration
import java.util.Base64
import java.util.UUID

class ExchangeClientTest {
    private lateinit var server: MockWebServer
    private lateinit var client: ExchangeClient

    private val publicationId = UUID.randomUUID()
    private val artifactId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        server = MockWebServer()
        server.start()
        val requestFactory = SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(Duration.ofSeconds(2))
            setReadTimeout(Duration.ofSeconds(2))
        }
        val restClient = RestClient.builder()
            .requestFactory(requestFactory)
            .baseUrl(server.url("/").toString().trimEnd('/'))
            .build()
        client = ExchangeClient(restClient, MAX_SIZE)
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `should request the publication path and parse the response ignoring unknown fields`() {
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """{"id":"$publicationId","name":"Plan","status":"PUBLISHED","unknown":1,""" +
                        """"artifacts":[{"id":"$artifactId","manifestType":"CASE_DEFINITION","extra":true}]}"""
                )
        )

        val publication = client.getPublication(publicationId)

        assertEquals("/api/v1/publications/$publicationId", server.takeRequest().path)
        assertEquals("Plan", publication?.name)
        assertEquals("PUBLISHED", publication?.status)
        assertEquals("CASE_DEFINITION", publication?.artifacts?.single()?.manifestType)
    }

    @Test
    fun `should return null when the publication does not exist`() {
        server.enqueue(MockResponse().setResponseCode(404))

        assertNull(client.getPublication(publicationId))
    }

    @Test
    fun `should throw unavailable on a server error`() {
        server.enqueue(MockResponse().setResponseCode(500))

        assertThrows<ExchangeUnavailableException> { client.getPublication(publicationId) }
    }

    @Test
    fun `should request the artifact path and return the content`() {
        val content = byteArrayOf(1, 2, 3)
        server.enqueue(MockResponse().setBody(Buffer().write(content)))

        val result = client.getArtifactContent(publicationId, artifactId)

        assertEquals("/api/v1/publications/$publicationId/artifacts/$artifactId", server.takeRequest().path)
        assertArrayEquals(content, result)
    }

    @Test
    fun `should throw not found when the artifact does not exist`() {
        server.enqueue(MockResponse().setResponseCode(404))

        assertThrows<ExchangeArtifactNotFoundException> { client.getArtifactContent(publicationId, artifactId) }
    }

    @Test
    fun `should throw too large when the body exceeds the maximum size`() {
        server.enqueue(MockResponse().setBody(Buffer().write(ByteArray((MAX_SIZE + 1).toInt()))))

        assertThrows<ExchangeArtifactTooLargeException> { client.getArtifactContent(publicationId, artifactId) }
    }

    @Test
    fun `should accept a body of exactly the maximum size`() {
        server.enqueue(MockResponse().setBody(Buffer().write(ByteArray(MAX_SIZE.toInt()))))

        assertEquals(MAX_SIZE.toInt(), client.getArtifactContent(publicationId, artifactId).size)
    }

    @Test
    fun `should decode a base64 JSON string body`() {
        val content = byteArrayOf(80, 75, 3, 4, 20)
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "application/json")
                .setBody("\"${Base64.getEncoder().encodeToString(content)}\"")
        )

        assertArrayEquals(content, client.getArtifactContent(publicationId, artifactId))
    }

    @Test
    fun `should throw too large when a decoded base64 JSON body exceeds the maximum size`() {
        val encoded = Base64.getEncoder().encodeToString(ByteArray((MAX_SIZE + 1).toInt()))
        server.enqueue(MockResponse().setHeader("Content-Type", "application/json").setBody("\"$encoded\""))

        assertThrows<ExchangeArtifactTooLargeException> { client.getArtifactContent(publicationId, artifactId) }
    }

    @Test
    fun `should throw unavailable on an unreadable JSON body`() {
        server.enqueue(MockResponse().setHeader("Content-Type", "application/json").setBody("{\"not\":\"base64\"}"))

        assertThrows<ExchangeUnavailableException> { client.getArtifactContent(publicationId, artifactId) }
    }

    companion object {
        private const val MAX_SIZE = 1024L
    }
}
