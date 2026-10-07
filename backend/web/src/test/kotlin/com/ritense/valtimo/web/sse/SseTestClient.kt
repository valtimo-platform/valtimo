/*
 *  Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package com.ritense.valtimo.web.sse

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import java.io.IOException
import java.io.InputStream
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

/** Minimal EventSource stand-in: reads data lines as JSON, counts comment lines (heartbeats). */
class SseTestClient(url: String) : AutoCloseable {

    private val client: HttpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()
    private val response: HttpResponse<InputStream> = client.send(
        HttpRequest.newBuilder(URI.create(url)).header("Accept", "text/event-stream").GET().build(),
        HttpResponse.BodyHandlers.ofInputStream(),
    )
    private val data = LinkedBlockingQueue<JsonNode>()
    private val closed = CountDownLatch(1)

    val status: Int = response.statusCode()
    val contentType: String? = response.headers().firstValue("Content-Type").orElse(null)
    val heartbeats = AtomicInteger()

    init {
        thread(isDaemon = true, name = "sse-test-reader") {
            try {
                response.body().bufferedReader().forEachLine { line ->
                    when {
                        line.startsWith("data:") -> data.add(MAPPER.readTree(line.removePrefix("data:").trim()))
                        line.startsWith(":") -> heartbeats.incrementAndGet()
                    }
                }
            } catch (_: IOException) {
                // client closed or server gone
            } finally {
                closed.countDown()
            }
        }
    }

    fun nextEvent(timeout: Duration = Duration.ofSeconds(5)): JsonNode? = data.poll(timeout.toMillis(), TimeUnit.MILLISECONDS)

    fun awaitClosed(timeout: Duration): Boolean = closed.await(timeout.toMillis(), TimeUnit.MILLISECONDS)

    /** Drops the connection without any goodbye, like a closed tab. */
    override fun close() {
        runCatching { response.body().close() }
        client.shutdownNow()
    }

    companion object {
        private val MAPPER = ObjectMapper()
    }
}
