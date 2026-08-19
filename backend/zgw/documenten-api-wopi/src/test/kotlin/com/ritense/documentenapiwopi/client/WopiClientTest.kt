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

package com.ritense.documentenapiwopi.client

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.web.client.RestClient
import kotlin.test.assertEquals

internal class WopiClientTest {

    private lateinit var mockWebServer: MockWebServer
    private lateinit var wopiClient: WopiClient

    @BeforeEach
    fun beforeEach() {
        mockWebServer = MockWebServer()
        mockWebServer.start()
        wopiClient = WopiClient(RestClient.builder())
    }

    @AfterEach
    fun afterEach() {
        mockWebServer.shutdown()
    }

    @Test
    fun `should only fetch WOPI discovery once and serve subsequent calls from cache`() {
        mockWebServer.enqueue(discoveryResponse())

        val discoveryUrl = mockWebServer.url("/hosting/discovery").let { java.net.URI(it.toString()) }

        val first = wopiClient.getWopiDiscovery(discoveryUrl)
        val second = wopiClient.getWopiDiscovery(discoveryUrl)

        assertEquals(first, second)
        assertEquals(1, mockWebServer.requestCount)
    }

    private fun discoveryResponse() = MockResponse()
        .addHeader("Content-Type", "application/xml")
        .setBody(
            """
                <?xml version="1.0" encoding="utf-8"?>
                <wopi-discovery>
                    <net-zone name="external-https">
                        <app name="Word" favIconUrl="https://example.com/word.ico">
                            <action name="edit" ext="docx" default="true" urlsrc="https://example.com/wopi/action"/>
                        </app>
                    </net-zone>
                </wopi-discovery>
            """.trimIndent()
        )
}
