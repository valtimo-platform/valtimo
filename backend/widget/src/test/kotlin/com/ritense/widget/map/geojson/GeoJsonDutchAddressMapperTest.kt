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

package com.ritense.widget.map.geojson

import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.widget.pdok.client.DutchAddress
import com.ritense.widget.pdok.client.LocatieserverDoc
import com.ritense.widget.pdok.client.LocatieserverResponseBody
import com.ritense.widget.pdok.client.LocatieserverSearchResponse
import com.ritense.widget.pdok.client.PdokLocatieserverClient
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.web.client.RestClientException
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class GeoJsonDutchAddressMapperTest {

    private val objectMapper = MapperSingleton.get()
    private val locatieserverClient: PdokLocatieserverClient = mock()
    private lateinit var mapper: GeoJsonDutchAddressMapper

    @BeforeEach
    fun setUp() {
        mapper = GeoJsonDutchAddressMapper(locatieserverClient)
    }

    @Test
    fun `supports returns true for postcode and huisnummer`() {
        val node = objectMapper.readTree("""{ "postcode": "1234AB", "huisnummer": 10 }""")
        assertTrue(mapper.supports(node))
    }

    @Test
    fun `supports returns true when huisnummer is a string`() {
        val node = objectMapper.readTree("""{ "postcode": "1234 AB", "huisnummer": "10" }""")
        assertTrue(mapper.supports(node))
    }

    @Test
    fun `supports returns true for straatnaam, huisnummer and woonplaats`() {
        val node = objectMapper.readTree(
            """{ "straatnaam": "Damrak", "huisnummer": 1, "woonplaats": "Amsterdam" }"""
        )
        assertTrue(mapper.supports(node))
    }

    @Test
    fun `supports returns true for straatnaam, huisnummer and postcode`() {
        val node = objectMapper.readTree(
            """{ "straatnaam": "Damrak", "huisnummer": 1, "postcode": "1012LG" }"""
        )
        assertTrue(mapper.supports(node))
    }

    @Test
    fun `supports returns true for straatnaam and woonplaats without huisnummer`() {
        val node = objectMapper.readTree("""{ "straatnaam": "Damrak", "woonplaats": "Amsterdam" }""")
        assertTrue(mapper.supports(node))
    }

    @Test
    fun `supports returns true for postcode and woonplaats without huisnummer`() {
        val node = objectMapper.readTree("""{ "postcode": "1012LG", "woonplaats": "Amsterdam" }""")
        assertTrue(mapper.supports(node))
    }

    @Test
    fun `supports returns false for postcode alone`() {
        val node = objectMapper.readTree("""{ "postcode": "1234AB" }""")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for huisnummer alone`() {
        val node = objectMapper.readTree("""{ "huisnummer": 10 }""")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for straatnaam alone`() {
        val node = objectMapper.readTree("""{ "straatnaam": "Damrak" }""")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for woonplaats alone`() {
        val node = objectMapper.readTree("""{ "woonplaats": "Amsterdam" }""")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for straatnaam and huisnummer without location`() {
        val node = objectMapper.readTree("""{ "straatnaam": "Damrak", "huisnummer": 1 }""")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false when postcode is blank`() {
        val node = objectMapper.readTree("""{ "postcode": "", "huisnummer": 10 }""")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `supports returns false for non-object node`() {
        val node = objectMapper.readTree("[1, 2]")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `mapToFeatures passes typed DutchAddress to client and returns Point feature`() {
        val expectedAddress = DutchAddress(postcode = "1011AB", huisnummer = "1")
        whenever(locatieserverClient.searchAddress(eq(expectedAddress), any()))
            .thenReturn(searchResponse("POINT(4.890123 52.370456)"))

        val node = objectMapper.readTree("""{ "postcode": "1011AB", "huisnummer": 1 }""")

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        val point = features.single().geometry as GeoJson.Point
        assertEquals(listOf(4.890123, 52.370456), point.coordinates)
    }

    @Test
    fun `mapToFeatures forwards all DutchAddress fields to client`() {
        val expectedAddress = DutchAddress(
            straatnaam = "Damrak",
            huisnummer = "1",
            huisletter = "A",
            huisnummertoevoeging = "bis",
            postcode = "1012LG",
            woonplaats = "Amsterdam",
        )
        whenever(locatieserverClient.searchAddress(eq(expectedAddress), any()))
            .thenReturn(searchResponse("POINT(5.0 52.0)"))

        val node = objectMapper.readTree(
            """
            {
              "straatnaam": "Damrak",
              "huisnummer": 1,
              "huisletter": "A",
              "huisnummertoevoeging": "bis",
              "postcode": "1012LG",
              "woonplaats": "Amsterdam"
            }
            """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)

        assertEquals(1, features.size)
        val point = features.single().geometry as GeoJson.Point
        assertEquals(listOf(5.0, 52.0), point.coordinates)
    }

    @Test
    fun `mapToFeatures geocodes street and city without postcode`() {
        val expectedAddress = DutchAddress(
            straatnaam = "Damrak",
            huisnummer = "1",
            woonplaats = "Amsterdam",
        )
        whenever(locatieserverClient.searchAddress(eq(expectedAddress), any()))
            .thenReturn(searchResponse("POINT(4.9 52.37)"))

        val node = objectMapper.readTree(
            """{ "straatnaam": "Damrak", "huisnummer": 1, "woonplaats": "Amsterdam" }"""
        )

        val features = mapper.mapToFeatures(node)
        val point = features.single().geometry as GeoJson.Point
        assertEquals(listOf(4.9, 52.37), point.coordinates)
    }

    @Test
    fun `mapToFeatures returns empty list when client returns no results`() {
        whenever(locatieserverClient.searchAddress(any(), any()))
            .thenReturn(LocatieserverSearchResponse(LocatieserverResponseBody(numFound = 0, docs = emptyList())))

        val node = objectMapper.readTree("""{ "postcode": "9999ZZ", "huisnummer": 999 }""")

        val features = mapper.mapToFeatures(node)

        assertTrue(features.isEmpty())
    }

    @Test
    fun `mapToFeatures returns empty list when client throws`() {
        whenever(locatieserverClient.searchAddress(any(), any()))
            .thenThrow(RestClientException("boom"))

        val node = objectMapper.readTree("""{ "postcode": "1011AB", "huisnummer": 1 }""")

        val features = mapper.mapToFeatures(node)

        assertTrue(features.isEmpty())
    }

    @Test
    fun `mapToFeatures returns empty list when WKT cannot be parsed`() {
        whenever(locatieserverClient.searchAddress(any(), any()))
            .thenReturn(searchResponse("INVALID"))

        val node = objectMapper.readTree("""{ "postcode": "1011AB", "huisnummer": 1 }""")

        val features = mapper.mapToFeatures(node)

        assertTrue(features.isEmpty())
    }

    @Test
    fun `mapToFeatures returns empty list when centroide_ll is null`() {
        whenever(locatieserverClient.searchAddress(any(), any()))
            .thenReturn(LocatieserverSearchResponse(LocatieserverResponseBody(numFound = 1, docs = listOf(LocatieserverDoc(centroideLl = null)))))

        val node = objectMapper.readTree("""{ "postcode": "1011AB", "huisnummer": 1 }""")

        val features = mapper.mapToFeatures(node)

        assertTrue(features.isEmpty())
    }

    @Test
    fun `mapToFeatures parses WKT with negative coordinates`() {
        whenever(locatieserverClient.searchAddress(any(), any()))
            .thenReturn(searchResponse("POINT(-1.5 -2.25)"))

        val node = objectMapper.readTree("""{ "postcode": "1011AB", "huisnummer": 1 }""")

        val features = mapper.mapToFeatures(node)
        val point = assertNotNull(features.single().geometry as? GeoJson.Point)
        assertEquals(listOf(-1.5, -2.25), point.coordinates)
    }

    @Test
    fun `mapToFeatures normalizes postcode with internal space and lowercase`() {
        val expectedAddress = DutchAddress(postcode = "1011AB", huisnummer = "1")
        whenever(locatieserverClient.searchAddress(eq(expectedAddress), any()))
            .thenReturn(searchResponse("POINT(4.9 52.37)"))

        val node = objectMapper.readTree("""{ "postcode": "1011 ab", "huisnummer": 1 }""")

        val features = mapper.mapToFeatures(node)
        val point = features.single().geometry as GeoJson.Point
        assertEquals(listOf(4.9, 52.37), point.coordinates)
    }

    @Test
    fun `mapToFeatures trims surrounding whitespace from string fields`() {
        val expectedAddress = DutchAddress(
            straatnaam = "Damrak",
            huisnummer = "1",
            huisletter = "A",
            postcode = "1012LG",
            woonplaats = "Amsterdam",
        )
        whenever(locatieserverClient.searchAddress(eq(expectedAddress), any()))
            .thenReturn(searchResponse("POINT(5.0 52.0)"))

        val node = objectMapper.readTree(
            """
            {
              "straatnaam": "  Damrak  ",
              "huisnummer": " 1 ",
              "huisletter": " A ",
              "postcode": " 1012 LG ",
              "woonplaats": "  Amsterdam "
            }
            """.trimIndent()
        )

        val features = mapper.mapToFeatures(node)
        val point = features.single().geometry as GeoJson.Point
        assertEquals(listOf(5.0, 52.0), point.coordinates)
    }

    @Test
    fun `supports treats whitespace-only postcode as blank`() {
        val node = objectMapper.readTree("""{ "postcode": "   ", "huisnummer": 10 }""")
        assertFalse(mapper.supports(node))
    }

    @Test
    fun `mapToFeatures does not call client when query is unsupported`() {
        val node = objectMapper.readTree("""{ "postcode": "1234AB" }""")

        assertFalse(mapper.supports(node))
        verify(locatieserverClient, never()).searchAddress(any(), any())
    }

    private fun searchResponse(wkt: String): LocatieserverSearchResponse {
        return LocatieserverSearchResponse(
            LocatieserverResponseBody(
                numFound = 1,
                docs = listOf(LocatieserverDoc(centroideLl = wkt))
            )
        )
    }
}
