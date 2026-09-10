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

package com.ritense.valtimo.contract.client

import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.assertTimeoutPreemptively
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.time.Duration
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.test.assertEquals

class ApacheRequestFactoryCustomizerTest {

    private lateinit var silentServer: ServerSocket
    private val acceptedConnections = CopyOnWriteArrayList<Socket>()

    @BeforeEach
    fun beforeEach() {
        silentServer = ServerSocket(0)
        // hold every accepted connection open without answering it, so the client is left waiting on a read
        Thread {
            while (!silentServer.isClosed) {
                runCatching { acceptedConnections += silentServer.accept() }
            }
        }.apply { isDaemon = true }.start()
    }

    @AfterEach
    fun afterEach() {
        silentServer.close()
        acceptedConnections.forEach { runCatching { it.close() } }
    }

    @Test
    fun `should give up reading from a server that accepts the connection and never answers`() {
        val restClient = restClientWith(ValtimoHttpRestClientConfigurationProperties(readTimeout = 2))

        val exception = assertTimeoutPreemptively(Duration.ofSeconds(30)) {
            assertThrows<ResourceAccessException> {
                restClient.get()
                    .uri("http://localhost:${silentServer.localPort}/")
                    .retrieve()
                    .body(String::class.java)
            }
        }

        assertEquals(SocketTimeoutException::class, exception.cause!!::class)
    }

    private fun restClientWith(properties: ValtimoHttpRestClientConfigurationProperties): RestClient {
        val restClientBuilder = RestClient.builder()
        ApacheRequestFactoryCustomizer(properties).customize(restClientBuilder)
        return restClientBuilder.build()
    }
}
