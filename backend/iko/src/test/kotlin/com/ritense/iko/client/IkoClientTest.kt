/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.iko.client

import com.ritense.iko.exception.IkoServerException
import com.ritense.valtimo.contract.json.MapperSingleton
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpStatus
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.web.client.RestClient
import java.net.URI
import java.time.Duration
import java.util.concurrent.TimeUnit.SECONDS

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class IkoClientTest {
    lateinit var mockApi: MockWebServer

    @BeforeAll
    fun setUp() {
        mockApi = MockWebServer()
        mockApi.start()
    }

    @AfterAll
    fun tearDown() {
        mockApi.shutdown()
    }

    @Test
    fun `should get iko JSON by id`() {
        val restClientBuilder = RestClient.builder()
        val client = IkoClient(restClientBuilder, MapperSingleton.get())

        val responseBody = """
            {
                "aNummer": "8940402024",
                "burgerservicenummer": "999993653",
                "datumEersteInschrijvingGBA": {
                    "type": "Datum",
                    "datum": "2013-11-02",
                    "langFormaat": "2 november 2013"
                },
                "geslacht": {
                    "code": "V",
                    "omschrijving": "vrouw"
                },
                "leeftijd": 39,
                "naam": {
                    "aanduidingNaamgebruik": {
                        "code": "E",
                        "omschrijving": "eigen geslachtsnaam"
                    },
                    "voornamen": "Suzanne",
                    "geslachtsnaam": "Moulin",
                    "voorletters": "S.",
                    "volledigeNaam": "Suzanne Moulin"
                },
                "nationaliteiten": [
                    {
                        "type": "Nationaliteit",
                        "datumIngangGeldigheid": {
                            "type": "DatumOnbekend",
                            "onbekend": true,
                            "langFormaat": "onbekend"
                        },
                        "nationaliteit": {
                            "code": "0057",
                            "omschrijving": "Franse"
                        },
                        "redenOpname": {
                            "code": "301",
                            "omschrijving": "Vaststelling bezit vreemde nationaliteit"
                        }
                    }
                ]
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val person = client.getByEndpointId(
            baseUrl = URI(mockApi.url("/").toString()),
            connectorTag = "brp",
            connectorInstanceTag = "brp",
            endpointOperation = "personen",
            id = "999993653",
        )

        //validate request
        assertEquals("GET /endpoints/brp/brp/personen/999993653 HTTP/1.1", mockApi.takeRequest().requestLine)

        //validate response
        assertEquals("999993653", person["burgerservicenummer"].asText())
        assertEquals("vrouw", person["geslacht"]["omschrijving"].asText())
        assertEquals(39, person["leeftijd"].numberValue())
        assertEquals("Suzanne Moulin", person["naam"]["volledigeNaam"].asText())
    }

    @Test
    fun `should send create besluit request and parse response when vervalreden is null`() {
        val restClientBuilder = RestClient.builder()
        val client = IkoClient(restClientBuilder, MapperSingleton.get())

        val responseBody = """
            {
                "type": "ZoekMetGeslachtsnaamEnGeboortedatum",
                "personen": [
                    {
                        "burgerservicenummer": "999993653",
                        "naam": {
                            "voornamen": "Suzanne",
                            "geslachtsnaam": "Moulin",
                            "voorletters": "S.",
                            "volledigeNaam": "Suzanne Moulin",
                            "aanduidingNaamgebruik": {
                                "code": "E",
                                "omschrijving": "eigen geslachtsnaam"
                            }
                        }
                    }
                ]
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val response = client.search(
            baseUrl = URI(mockApi.url("/").toString()),
            connectorTag = "brp",
            connectorInstanceTag = "brp",
            endpointOperation = "personen",
            queryParams = mapOf(
                "geslachtsnaam" to "Moulin",
                "geboortedatum" to "1985-12-01",
            )
        )

        //validate request
        assertEquals(
            "GET /endpoints/brp/brp/personen?geslachtsnaam=Moulin&geboortedatum=1985-12-01 HTTP/1.1",
            mockApi.takeRequest().requestLine
        )

        //validate response
        assertEquals("ZoekMetGeslachtsnaamEnGeboortedatum", response["type"].asText())
        assertEquals("999993653", response["personen"][0]["burgerservicenummer"].asText())
        assertEquals("Suzanne Moulin", response["personen"][0]["naam"]["volledigeNaam"].asText())
    }

    @Test
    fun `should throw when the iko server returns an error`() {
        val client = IkoClient(RestClient.builder(), MapperSingleton.get())

        mockApi.enqueue(MockResponse().setResponseCode(500))

        val exception = assertThrows<IkoServerException> {
            client.getByEndpointId(
                baseUrl = URI(mockApi.url("/").toString()),
                connectorTag = "brp",
                connectorInstanceTag = "brp",
                endpointOperation = "personen",
                id = "999993653",
            )
        }

        assertEquals(HttpStatus.BAD_GATEWAY, exception.statusCode)
    }

    @Test
    fun `should throw when the iko server does not respond in time`() {
        val restClientBuilder = RestClient.builder().requestFactory(
            SimpleClientHttpRequestFactory().apply { setReadTimeout(Duration.ofMillis(100)) }
        )
        val client = IkoClient(restClientBuilder, MapperSingleton.get())

        mockApi.enqueue(mockResponse("{}").setBodyDelay(1, SECONDS))

        val exception = assertThrows<IkoServerException> {
            client.search(
                baseUrl = URI(mockApi.url("/").toString()),
                connectorTag = "brp",
                connectorInstanceTag = "brp",
                endpointOperation = "personen",
            )
        }

        assertEquals(HttpStatus.BAD_GATEWAY, exception.statusCode)
    }

    private fun mockResponse(body: String): MockResponse {
        return MockResponse()
            .addHeader("Content-Type", "application/json")
            .setBody(body)
    }
}
