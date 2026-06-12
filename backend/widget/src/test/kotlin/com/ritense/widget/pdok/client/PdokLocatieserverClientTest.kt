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

package com.ritense.widget.pdok.client

import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.ExpectedCount
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import java.net.URI
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class PdokLocatieserverClientTest {

    private val baseUrl = URI("https://api.pdok.nl/bzk/locatieserver/search/v3_1")
    private lateinit var restClientBuilder: RestClient.Builder
    private lateinit var mockServer: MockRestServiceServer
    private lateinit var client: PdokLocatieserverClient

    @BeforeEach
    fun setUp() {
        restClientBuilder = RestClient.builder()
        mockServer = MockRestServiceServer.bindTo(restClientBuilder).build()
        client = PdokLocatieserverClient(restClientBuilder, baseUrl)
    }

    @AfterEach
    fun tearDown() {
        mockServer.verify()
    }

    @Test
    fun `searchAddress sends GET to free endpoint with query built from postcode and huisnummer`() {
        val responseBody = """
            {
              "response": {
                "numFound": 1,
                "docs": [
                  {
                    "id": "adr-1",
                    "weergavenaam": "Dam 1, 1011AB Amsterdam",
                    "type": "adres",
                    "centroide_ll": "POINT(4.890123 52.370456)"
                  }
                ]
              }
            }
        """.trimIndent()

        mockServer
            .expect(ExpectedCount.once(), requestTo(containsString("/bzk/locatieserver/search/v3_1/free")))
            .andExpect(method(HttpMethod.GET))
            .andExpect(queryParam("q", "1%201011AB"))
            .andExpect(queryParam("fl", "id,weergavenaam,type,centroide_ll,centroide_rd"))
            .andExpect(queryParam("rows", "1"))
            .andExpect(queryParam("fq", "type:adres"))
            .andRespond(withSuccess(responseBody, MediaType.APPLICATION_JSON))

        val response = client.searchAddress(DutchAddress(postcode = "1011AB", huisnummer = "1"))

        assertEquals(1, response.response.numFound)
        assertEquals("POINT(4.890123 52.370456)", response.response.docs.single().centroideLl)
    }

    @Test
    fun `searchAddress builds query from all DutchAddress fields in canonical order`() {
        val responseBody = """{ "response": { "numFound": 0, "docs": [] } }"""

        mockServer
            .expect(ExpectedCount.once(), requestTo(containsString("/free")))
            .andExpect(queryParam("q", "Damrak%201%20A%20bis%201012LG%20Amsterdam"))
            .andRespond(withSuccess(responseBody, MediaType.APPLICATION_JSON))

        client.searchAddress(
            DutchAddress(
                straatnaam = "Damrak",
                huisnummer = "1",
                huisletter = "A",
                huisnummertoevoeging = "bis",
                postcode = "1012LG",
                woonplaats = "Amsterdam",
            ),
        )
    }

    @Test
    fun `searchAddress respects custom rows parameter`() {
        val responseBody = """{ "response": { "numFound": 0, "docs": [] } }"""

        mockServer
            .expect(ExpectedCount.once(), requestTo(containsString("/free")))
            .andExpect(queryParam("rows", "5"))
            .andExpect(queryParam("fq", "type:adres"))
            .andRespond(withSuccess(responseBody, MediaType.APPLICATION_JSON))

        val response = client.searchAddress(
            DutchAddress(straatnaam = "Damrak", woonplaats = "Amsterdam"),
            rows = 5,
        )

        assertEquals(0, response.response.numFound)
    }

    @Test
    fun `searchAddress propagates server errors`() {
        mockServer
            .expect(ExpectedCount.once(), requestTo(containsString("/free")))
            .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR))

        assertFailsWith<RestClientException> {
            client.searchAddress(DutchAddress(postcode = "1011AB", huisnummer = "1"))
        }
    }

    @Test
    fun `searchAddress ignores unknown response fields`() {
        val responseBody = """
            {
              "responseHeader": { "status": 0, "QTime": 1 },
              "response": {
                "numFound": 1,
                "start": 0,
                "maxScore": 12.34,
                "docs": [
                  {
                    "id": "adr-1",
                    "type": "adres",
                    "centroide_ll": "POINT(4.0 52.0)",
                    "extra_unknown": "ignored"
                  }
                ]
              }
            }
        """.trimIndent()

        mockServer
            .expect(ExpectedCount.once(), requestTo(containsString("/free")))
            .andRespond(withSuccess(responseBody, MediaType.APPLICATION_JSON))

        val response = client.searchAddress(DutchAddress(postcode = "1011AB", huisnummer = "1"))

        assertEquals("POINT(4.0 52.0)", response.response.docs.single().centroideLl)
    }
}
