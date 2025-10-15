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

package com.ritense.zakenapi.client

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.authorization.AuthorizationService
import com.ritense.outbox.OutboxService
import com.ritense.outbox.domain.BaseEvent
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.zakenapi.ZakenApiAuthentication
import com.ritense.zakenapi.domain.*
import com.ritense.zakenapi.domain.rol.BetrokkeneType
import com.ritense.zakenapi.domain.rol.IndicatieMachtiging
import com.ritense.zakenapi.domain.rol.Rol
import com.ritense.zakenapi.domain.rol.RolNatuurlijkPersoon
import com.ritense.zakenapi.domain.rol.RolNietNatuurlijkPersoon
import com.ritense.zakenapi.domain.rol.RolTypeGeneriekeBeschrijving
import com.ritense.zakenapi.domain.rol.ZaakRolOmschrijving
import com.ritense.zakenapi.event.*
import com.ritense.zgw.Rsin
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.QueueDispatcher
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.*
import org.springframework.context.ApplicationEventPublisher
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient
import org.springframework.web.reactive.function.client.ClientRequest
import org.springframework.web.reactive.function.client.ClientResponse
import org.springframework.web.reactive.function.client.ExchangeFunction
import reactor.core.publisher.Mono
import java.net.URI
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZonedDateTime
import java.util.UUID
import java.util.function.Supplier
import kotlin.test.assertNull

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
internal class ZakenApiClientTest {

    private val objectMapper: ObjectMapper = MapperSingleton.get()
    private val restClientBuilder: RestClient.Builder = RestClient.builder()

    private lateinit var mockApi: MockWebServer
    private lateinit var outboxService: OutboxService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var applicationEventPublisher: ApplicationEventPublisher

    @BeforeAll
    fun setupAll() {
        mockApi = MockWebServer()
        mockApi.start()
    }

    @AfterAll
    fun tearDownAll() {
        mockApi.shutdown()
    }

    @BeforeEach
    fun beforeEach() {
        outboxService = mock()
        authorizationService = mock {
            on { this.hasPermission<Any>(any()) } doReturn true
        }
        applicationEventPublisher = mock()
    }

    @Test
    fun `should send link document request and parse response`() {
        val zaakUrl = zaakUri()
        val zaakUrlAsString = zaakUrl.toASCIIString()
        val client = zakenApiClient()

        val responseBody = """
            {
              "url": "$HTTPS_EXAMPLE_COM",
              "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
              "informatieobject": "$HTTPS_EXAMPLE_COM",
              "zaak": "$zaakUrl",
              "aardRelatieWeergave": "Hoort bij, omgekeerd: kent",
              "titel": "string",
              "beschrijving": "string",
              "registratiedatum": "2019-08-24T14:15:22Z"
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.linkDocument(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            request = LinkDocumentRequest(
                informatieobject = HTTPS_EXAMPLE_COM,
                zaak = zaakUrlAsString,
                titel = "title",
                beschrijving = "description"
            )
        )

        val recordedRequest = mockApi.takeRequest()
        val requestString = recordedRequest.body.readUtf8()
        val parsedOutput: Map<String, Any> = objectMapper.readValue(requestString)

        assertEquals("Bearer test", recordedRequest.getHeader("Authorization"))

        assertEquals(HTTPS_EXAMPLE_COM, parsedOutput["informatieobject"])
        assertEquals(zaakUrlAsString, parsedOutput["zaak"])
        assertEquals("title", parsedOutput["titel"])
        assertEquals("description", parsedOutput["beschrijving"])

        assertEquals(HTTPS_EXAMPLE_COM, result.url)
        assertEquals(HTTPS_EXAMPLE_COM, result.informatieobject)
        assertEquals(zaakUrlAsString, result.zaak)
        assertEquals(UUID.fromString("095be615-a8ad-4c33-8e9c-c7612fbf6c9f"), result.uuid)
        assertEquals("string", result.titel)
        assertEquals("string", result.beschrijving)
        assertEquals("Hoort bij, omgekeerd: kent", result.aardRelatieWeergave)
        assertEquals(LocalDateTime.of(2019, 8, 24, 14, 15, 22), result.registratiedatum)
    }

    @Test
    fun `should not include null fields when creating zaakstatus`() {
        val zaakUrl = zaakUri()
        val client = zakenApiClient()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        assertThrows<HttpClientErrorException> {
            client.createZaakStatus(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                request = CreateZaakStatusRequest(
                    zaak = zaakUrl,
                    datumStatusGezet = LocalDateTime.parse("2023-03-03T03:03:00"),
                    statustype = exampleUri(),
                    statustoelichting = null
                )
            )
        }

        val recordedRequest = mockApi.takeRequest()
        val requestString = recordedRequest.body.readUtf8()
        val parsedOutput: Map<String, Any> = objectMapper.readValue(requestString)

        assertEquals(zaakUrl.toASCIIString(), parsedOutput["zaak"])
        assertEquals(HTTPS_EXAMPLE_COM, parsedOutput["statustype"])
        assertNull(parsedOutput["statustoelichting"])
    }

    @Test
    fun `should send outbox message on linking document`() {
        val client = zakenApiClient()

        val uuid = "095be615-a8ad-4c33-8e9c-c7612fbf6c9f"
        val responseBody = """
            {
              "url": "$HTTPS_EXAMPLE_COM",
              "uuid": "$uuid",
              "informatieobject": "$HTTPS_EXAMPLE_COM",
              "zaak": "${zaakUri()}",
              "aardRelatieWeergave": "Hoort bij, omgekeerd: kent",
              "titel": "string",
              "beschrijving": "string",
              "registratiedatum": "2019-08-24T14:15:22Z"
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        client.linkDocument(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            request = LinkDocumentRequest(
                informatieobject = HTTPS_EXAMPLE_COM,
                zaak = zaakUri().toASCIIString(),
                titel = "title",
                beschrijving = "description"
            )
        )

        mockApi.takeRequest()

        verify(applicationEventPublisher).publishEvent(anyVararg(DocumentLinkedToZaak::class))
        verify(outboxService).send(eventCapture.capture())

        val firstEventValue = eventCapture.firstValue.get()
        val mappedResult: LinkDocumentResult = objectMapper.readValue(firstEventValue.result.toString())
        val mappedResponseBody: LinkDocumentResult = objectMapper.readValue(responseBody)

        assertThat(firstEventValue).isInstanceOf(DocumentLinkedToZaak::class.java)
        assertThat(firstEventValue.resultId).isEqualTo(uuid)
        assertThat(mappedResult.beschrijving).isEqualTo(mappedResponseBody.beschrijving)
    }

    @Test
    fun `should not send outbox message on failing to link document`() {
        val client = zakenApiClient()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        assertThrows<HttpClientErrorException> {
            client.linkDocument(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                request = LinkDocumentRequest(
                    informatieobject = HTTPS_EXAMPLE_COM,
                    zaak = zaakUri().toASCIIString(),
                    titel = "title",
                    beschrijving = "description"
                )
            )
        }

        mockApi.takeRequest()

        verify(outboxService, times(0)).send(eventCapture.capture())
    }

    @Test
    fun `should send get zaakobjecten request and parse response`() {
        val zaakObjectId = "095be615-a8ad-4c33-8e9c-c7612fbf6c9f"
        val zaakUrl = zaakUri()
        val client = zakenApiClient()

        val responseBody = """
            {
              "count": 1,
              "next": "$HTTPS_EXAMPLE_COM",
              "previous": "$HTTPS_EXAMPLE_COM",
              "results": [
                {
                  "url": "$HTTPS_EXAMPLE_COM",
                  "uuid": "$zaakObjectId",
                  "zaak": "$zaakUrl",
                  "object": "$HTTPS_EXAMPLE_COM",
                  "objectType": "adres",
                  "objectTypeOverige": "string",
                  "relatieomschrijving": "string"
                }
              ]
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.getZaakObjecten(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            zaakUrl = exampleUri(),
            page = 1
        )

        val recordedRequest = mockApi.takeRequest()
        val requestUrl = recordedRequest.requestUrl

        assertEquals("Bearer test", recordedRequest.getHeader("Authorization"))
        assertEquals(HTTPS_EXAMPLE_COM, requestUrl?.queryParameter("zaak"))
        assertEquals("1", requestUrl?.queryParameter("page"))

        assertEquals(1, result.count)
        assertEquals(exampleUri(), result.next)
        assertEquals(exampleUri(), result.previous)
        assertEquals(exampleUri(), result.results[0].url)
        assertEquals(UUID.fromString(zaakObjectId), result.results[0].uuid)
        assertEquals(zaakUrl, result.results[0].zaakUrl)
        assertEquals(exampleUri(), result.results[0].objectUrl)
        assertEquals("adres", result.results[0].objectType)
        assertEquals("string", result.results[0].objectTypeOverige)
        assertEquals("string", result.results[0].relatieomschrijving)
    }

    @Test
    fun `should send outbox message on retrieving zaakobjecten`() {
        val client = zakenApiClient()

        val responseBody = """
            {
              "count": 1,
              "next": "$HTTPS_EXAMPLE_COM",
              "previous": "$HTTPS_EXAMPLE_COM",
              "results": [
                {
                  "url": "$HTTPS_EXAMPLE_COM",
                  "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                  "zaak": "${zaakUri()}",
                  "object": "$HTTPS_EXAMPLE_COM",
                  "objectType": "adres",
                  "objectTypeOverige": "string",
                  "relatieomschrijving": "string"
                }
              ]
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        val result = client.getZaakObjecten(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            zaakUrl = exampleUri(),
            page = 1
        )

        mockApi.takeRequest()

        verify(outboxService).send(eventCapture.capture())

        val firstEventValue = eventCapture.firstValue.get()
        val mappedFirstEventResult: List<ZaakObject> = objectMapper.readValue(firstEventValue.result.toString())

        assertThat(firstEventValue).isInstanceOf(ZaakObjectenListed::class.java)
        assertThat(result.results.first().relatieomschrijving)
            .isEqualTo(mappedFirstEventResult.first().relatieomschrijving)
    }

    @Test
    fun `should not send outbox message on failing to retrieve zaakobjecten`() {
        val client = zakenApiClient()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        assertThrows<HttpClientErrorException> {
            client.getZaakObjecten(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                zaakUrl = exampleUri(),
                page = 1
            )
        }

        mockApi.takeRequest()

        verify(outboxService, times(0)).send(eventCapture.capture())
    }

    @Test
    fun `should send get zaakinformatieobjecten request and parse response`() {
        val client = zakenApiClient()

        val informatieObjectJson = """
            {
                "url": "http://example.com",
                "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                "informatieobject": "http://example.com",
                "zaak": "http://example.com",
                "aardRelatieWeergave": "Hoort bij, omgekeerd: kent",
                "titel": "test",
                "beschrijving": "test omschrijving",
                "registratiedatum": "2019-08-24T14:15:22Z",
                "vernietigingsdatum": "2019-08-24T14:15:22Z",
                "status": "http://example.com"
            }
        """.trimIndent()
        val responseBody = """
            [
                $informatieObjectJson, $informatieObjectJson
            ]
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.getZaakInformatieObjecten(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            zaakUrl = exampleUri()
        )

        val recordedRequest = mockApi.takeRequest()
        val requestUrl = recordedRequest.requestUrl

        assertEquals("Bearer test", recordedRequest.getHeader("Authorization"))
        assertEquals(HTTPS_EXAMPLE_COM, requestUrl?.queryParameter("zaak"))
        assertEquals(2, result.size)

        val value = result.first()
        assertEquals(URI("http://example.com"), value.url)
        assertEquals(UUID.fromString("095be615-a8ad-4c33-8e9c-c7612fbf6c9f"), value.uuid)
        assertEquals(URI("http://example.com"), value.informatieobject)
        assertEquals(URI("http://example.com"), value.zaak)
        assertEquals("Hoort bij, omgekeerd: kent", value.aardRelatieWeergave)
        assertEquals("test", value.titel)
        assertEquals("test omschrijving", value.beschrijving)
        assertEquals(ZonedDateTime.parse("2019-08-24T14:15:22Z").toLocalDateTime(), value.registratiedatum)
        assertEquals(ZonedDateTime.parse("2019-08-24T14:15:22Z").toLocalDateTime(), value.vernietigingsdatum)
        assertEquals(URI("http://example.com"), value.status)
    }

    @Test
    fun `should send outbox message on retrieving zaakinformatieobjecten`() {
        val client = zakenApiClient()

        val informatieObjectJson = """
            {
                "url": "http://example.com",
                "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                "informatieobject": "http://example.com",
                "zaak": "http://example.com",
                "aardRelatieWeergave": "Hoort bij, omgekeerd: kent",
                "titel": "test",
                "beschrijving": "test omschrijving",
                "registratiedatum": "2019-08-24T14:15:22Z",
                "vernietigingsdatum": "2019-08-24T14:15:22Z",
                "status": "http://example.com"
            }
        """.trimIndent()
        val responseBody = """
            [
                $informatieObjectJson, $informatieObjectJson
            ]
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        val result = client.getZaakInformatieObjecten(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            zaakUrl = exampleUri()
        )

        mockApi.takeRequest()

        verify(outboxService).send(eventCapture.capture())

        val firstEventValue = eventCapture.firstValue.get()
        val mappedFirstEventResult: List<ZaakInformatieObject> =
            objectMapper.readValue(firstEventValue.result.toString())

        assertThat(firstEventValue).isInstanceOf(ZaakInformatieObjectenListed::class.java)
        assertThat(result.first().beschrijving).isEqualTo(mappedFirstEventResult.first().beschrijving)
    }

    @Test
    fun `should not send outbox message on failing to retrieve zaakinformatieobjecten`() {
        val client = zakenApiClient()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        assertThrows<HttpClientErrorException> {
            client.getZaakInformatieObjecten(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                zaakUrl = exampleUri()
            )
        }

        mockApi.takeRequest()

        verify(outboxService, times(0)).send(eventCapture.capture())
    }

    @Test
    fun `should send get zaakrollen request and parse response`() {
        val client = zakenApiClient()

        val responseBody = """
            {
              "count": 1,
              "next": "$HTTPS_EXAMPLE_COM/next",
              "previous": "$HTTPS_EXAMPLE_COM/previous",
              "results": [
                {
                  "zaak": "$HTTPS_EXAMPLE_COM/zaak",
                  "betrokkene": "$HTTPS_EXAMPLE_COM/betrokkene",
                  "betrokkeneType": "natuurlijk_persoon",
                  "roltype": "$HTTPS_EXAMPLE_COM/roltype",
                  "roltoelichting": "initiator",
                  "betrokkeneIdentificatie": {
                    "inpBsn": "059861095"
                  },
                  "unknownProperty": "value"
                }
              ]
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.getZaakRollen(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            zaakUrl = exampleUri(),
            page = 1,
            omschrijvingGeneriek = RolTypeGeneriekeBeschrijving.INITIATOR
        )

        val recordedRequest = mockApi.takeRequest()
        val requestUrl = recordedRequest.requestUrl

        assertEquals("Bearer test", recordedRequest.getHeader("Authorization"))
        assertEquals(HTTPS_EXAMPLE_COM, requestUrl?.queryParameter("zaak"))
        assertEquals("1", requestUrl?.queryParameter("page"))

        assertEquals(1, result.count)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/next"), result.next)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/previous"), result.previous)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/betrokkene"), result.results.first().betrokkene)
        assertEquals(BetrokkeneType.NATUURLIJK_PERSOON, result.results.first().betrokkeneType)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/zaak"), result.results.first().zaak)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/roltype"), result.results.first().roltype)
        assertEquals("initiator", result.results.first().roltoelichting)
        assertEquals(RolNatuurlijkPersoon(inpBsn = "059861095"), result.results.first().betrokkeneIdentificatie)
    }

    @Test
    fun `should send outbox message on retrieving zaakrollen`() {
        val client = zakenApiClient()

        val responseBody = """
            {
              "count": 1,
              "next": "$HTTPS_EXAMPLE_COM/next",
              "previous": "$HTTPS_EXAMPLE_COM/previous",
              "results": [
                {
                  "zaak": "$HTTPS_EXAMPLE_COM/zaak",
                  "betrokkene": "$HTTPS_EXAMPLE_COM/betrokkene",
                  "betrokkeneType": "natuurlijk_persoon",
                  "roltype": "$HTTPS_EXAMPLE_COM/roltype",
                  "roltoelichting": "initiator",
                  "betrokkeneIdentificatie": {
                    "inpBsn": "059861095"
                  },
                  "unknownProperty": "value"
                }
              ]
            }
        """.trimIndent()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.getZaakRollen(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            zaakUrl = exampleUri(),
            page = 1,
            omschrijvingGeneriek = RolTypeGeneriekeBeschrijving.INITIATOR
        )

        mockApi.takeRequest()

        verify(outboxService).send(eventCapture.capture())

        val firstEventValue = eventCapture.firstValue.get()
        val mappedFirstEventResult: List<Rol> = objectMapper.readValue(firstEventValue.result.toString())

        assertThat(firstEventValue).isInstanceOf(ZaakRollenListed::class.java)
        assertThat(result.results.first().roltoelichting)
            .isEqualTo(mappedFirstEventResult.first().roltoelichting)
    }

    @Test
    fun `should not send outbox message on failing to retrieve zaakrollen`() {
        val client = zakenApiClient()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        assertThrows<HttpClientErrorException> {
            client.getZaakRollen(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                zaakUrl = exampleUri(),
                page = 1,
                omschrijvingGeneriek = RolTypeGeneriekeBeschrijving.INITIATOR
            )
        }

        mockApi.takeRequest()

        verify(outboxService, times(0)).send(eventCapture.capture())
    }

    @Test
    fun `should send create natuurlijk persoon zaakrol request and parse response`() {
        val client = zakenApiClient()

        val responseBody = """
            {
              "url": "$HTTPS_EXAMPLE_COM/rol/d31cd83f-11da-4932-bde8-a9123c9821d3",
              "uuid": "d31cd83f-11da-4932-bde8-a9123c9821d3",
              "zaak": "$HTTPS_EXAMPLE_COM/zaak",
              "betrokkene": "$HTTPS_EXAMPLE_COM/betrokkene",
              "betrokkeneType": "natuurlijk_persoon",
              "roltype": "$HTTPS_EXAMPLE_COM/roltype",
              "omschrijving": "omschrijving",
              "omschrijvingGeneriek": "initiator",
              "roltoelichting": "roltoelichting",
              "registratiedatum": "2019-08-24T14:15:22Z",
              "indicatieMachtiging": "gemachtigde",
              "betrokkeneIdentificatie": {
                "inpBsn": "inpBsn",
                "anpIdentificatie": "anpIdentificatie",
                "inpA_nummer": "inpA_nummer",
                "geslachtsnaam": "geslachtsnaam",
                "voorvoegselGeslachtsnaam": "voorvoegselGeslachtsnaam",
                "voorletters": "voorletters",
                "voornamen": "voornamen",
                "geslachtsaanduiding": "m",
                "geboortedatum": "geboortedatum",
                "verblijfsadres": {
                  "aoaIdentificatie": "string",
                  "wplWoonplaatsNaam": "string",
                  "gorOpenbareRuimteNaam": "string",
                  "aoaPostcode": "string",
                  "aoaHuisnummer": 0,
                  "aoaHuisletter": "s",
                  "aoaHuisnummertoevoeging": "a",
                  "inpLocatiebeschrijving": "string"
                },
                "subVerblijfBuitenland": {
                  "lndLandcode": "stri",
                  "lndLandnaam": "string",
                  "subAdresBuitenland_1": "string",
                  "subAdresBuitenland_2": "string",
                  "subAdresBuitenland_3": "string"
                }
              }
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.createZaakRol(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            rol = Rol(
                zaak = URI("$HTTPS_EXAMPLE_COM/zaak"),
                betrokkeneType = BetrokkeneType.NATUURLIJK_PERSOON,
                roltype = URI("$HTTPS_EXAMPLE_COM/roltype"),
                roltoelichting = "test",
                betrokkeneIdentificatie = RolNatuurlijkPersoon()
            )
        )

        verify(applicationEventPublisher).publishEvent(anyVararg(ZaakRolCreated::class))

        val recordedRequest = mockApi.takeRequest()
        // val requestUrl = recordedRequest.requestUrl

        assertEquals("Bearer test", recordedRequest.getHeader("Authorization"))

        assertEquals(URI("$HTTPS_EXAMPLE_COM/rol/d31cd83f-11da-4932-bde8-a9123c9821d3"), result.url)
        assertEquals(UUID.fromString("d31cd83f-11da-4932-bde8-a9123c9821d3"), result.uuid)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/zaak"), result.zaak)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/betrokkene"), result.betrokkene)
        assertEquals(BetrokkeneType.NATUURLIJK_PERSOON, result.betrokkeneType)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/roltype"), result.roltype)
        assertEquals("omschrijving", result.omschrijving)
        assertEquals(ZaakRolOmschrijving.INITIATOR, result.omschrijvingGeneriek)
        assertEquals("roltoelichting", result.roltoelichting)
        assertEquals(LocalDateTime.of(2019, 8, 24, 14, 15, 22), result.registratiedatum)
        assertEquals(IndicatieMachtiging.GEMACHTIGDE, result.indicatieMachtiging)

        val betrokkeneIdentificatie = result.betrokkeneIdentificatie as RolNatuurlijkPersoon
        assertEquals("inpBsn", betrokkeneIdentificatie.inpBsn)
        assertEquals("anpIdentificatie", betrokkeneIdentificatie.anpIdentificatie)
        assertEquals("inpA_nummer", betrokkeneIdentificatie.inpA_nummer)
        assertEquals("geslachtsnaam", betrokkeneIdentificatie.geslachtsnaam)
        assertEquals("voorvoegselGeslachtsnaam", betrokkeneIdentificatie.voorvoegselGeslachtsnaam)
        assertEquals("voorletters", betrokkeneIdentificatie.voorletters)
        assertEquals("voornamen", betrokkeneIdentificatie.voornamen)
        assertEquals("m", betrokkeneIdentificatie.geslachtsaanduiding)
        assertEquals("geboortedatum", betrokkeneIdentificatie.geboortedatum)
    }

    @Test
    fun `should send create niet-natuurlijk persoon zaakrol request and parse response`() {
        val client = zakenApiClient()

        val responseBody = """
            {
              "url": "$HTTPS_EXAMPLE_COM/rol/d31cd83f-11da-4932-bde8-a9123c9821d3",
              "uuid": "d31cd83f-11da-4932-bde8-a9123c9821d3",
              "zaak": "$HTTPS_EXAMPLE_COM/zaak",
              "betrokkene": "$HTTPS_EXAMPLE_COM/betrokkene",
              "betrokkeneType": "niet_natuurlijk_persoon",
              "roltype": "$HTTPS_EXAMPLE_COM/roltype",
              "omschrijving": "omschrijving",
              "omschrijvingGeneriek": "initiator",
              "roltoelichting": "roltoelichting",
              "registratiedatum": "2019-08-24T14:15:22Z",
              "indicatieMachtiging": "gemachtigde",
              "betrokkeneIdentificatie": {
                "annIdentificatie": "annIdentificatie",
                "innNnpId": "innNnpId",
                "statutaireNaam": "statutaireNaam",
                "innRechtsvorm": "besloten_vennootschap",
                "bezoekadres": "bezoekadres"
              }
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.createZaakRol(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            rol = Rol(
                zaak = URI("$HTTPS_EXAMPLE_COM/zaak"),
                betrokkeneType = BetrokkeneType.NIET_NATUURLIJK_PERSOON,
                roltype = URI("$HTTPS_EXAMPLE_COM/roltype"),
                roltoelichting = "test",
                betrokkeneIdentificatie = RolNietNatuurlijkPersoon(
                    annIdentificatie = "annIdentificatie"
                )
            )
        )

        val recordedRequest = mockApi.takeRequest()
        // val requestUrl = recordedRequest.requestUrl

        assertEquals("Bearer test", recordedRequest.getHeader("Authorization"))

        assertEquals(URI("$HTTPS_EXAMPLE_COM/rol/d31cd83f-11da-4932-bde8-a9123c9821d3"), result.url)
        assertEquals(UUID.fromString("d31cd83f-11da-4932-bde8-a9123c9821d3"), result.uuid)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/zaak"), result.zaak)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/betrokkene"), result.betrokkene)
        assertEquals(BetrokkeneType.NIET_NATUURLIJK_PERSOON, result.betrokkeneType)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/roltype"), result.roltype)
        assertEquals("omschrijving", result.omschrijving)
        assertEquals(ZaakRolOmschrijving.INITIATOR, result.omschrijvingGeneriek)
        assertEquals("roltoelichting", result.roltoelichting)
        assertEquals(LocalDateTime.of(2019, 8, 24, 14, 15, 22), result.registratiedatum)
        assertEquals(IndicatieMachtiging.GEMACHTIGDE, result.indicatieMachtiging)

        val betrokkeneIdentificatie = result.betrokkeneIdentificatie as RolNietNatuurlijkPersoon
        assertEquals("annIdentificatie", betrokkeneIdentificatie.annIdentificatie)
        assertEquals("innNnpId", betrokkeneIdentificatie.innNnpId)
        assertEquals("statutaireNaam", betrokkeneIdentificatie.statutaireNaam)
        assertEquals("besloten_vennootschap", betrokkeneIdentificatie.innRechtsvorm)
        assertEquals("bezoekadres", betrokkeneIdentificatie.bezoekadres)
    }

    @Test
    fun `should send update zaakrol request and parse response`() {
        val client = zakenApiClient()

        val responseBody = """
            {
              "url": "$HTTPS_EXAMPLE_COM/rol/d31cd83f-11da-4932-bde8-a9123c9821d3",
              "uuid": "d31cd83f-11da-4932-bde8-a9123c9821d3",
              "zaak": "$HTTPS_EXAMPLE_COM/zaak",
              "betrokkene": "$HTTPS_EXAMPLE_COM/betrokkene",
              "betrokkeneType": "niet_natuurlijk_persoon",
              "roltype": "$HTTPS_EXAMPLE_COM/roltype",
              "omschrijving": "omschrijving",
              "omschrijvingGeneriek": "initiator",
              "roltoelichting": "roltoelichting",
              "registratiedatum": "2019-08-24T14:15:22Z",
              "indicatieMachtiging": "gemachtigde",
              "betrokkeneIdentificatie": {
                "annIdentificatie": "annIdentificatie",
                "innNnpId": "innNnpId",
                "statutaireNaam": "statutaireNaam",
                "innRechtsvorm": "besloten_vennootschap",
                "bezoekadres": "bezoekadres"
              }
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.updateZaakRol(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            rolUuid = UUID.fromString("d31cd83f-11da-4932-bde8-a9123c9821d3"),
            rol = Rol(
                zaak = URI("$HTTPS_EXAMPLE_COM/zaak"),
                betrokkeneType = BetrokkeneType.NIET_NATUURLIJK_PERSOON,
                roltype = URI("$HTTPS_EXAMPLE_COM/roltype"),
                roltoelichting = "test",
                betrokkeneIdentificatie = RolNietNatuurlijkPersoon(
                    annIdentificatie = "annIdentificatie"
                )
            )
        )

        verify(applicationEventPublisher).publishEvent(anyVararg(ZaakRolUpdated::class))

        val recordedRequest = mockApi.takeRequest()
        // val requestUrl = recordedRequest.requestUrl

        assertEquals("Bearer test", recordedRequest.getHeader("Authorization"))

        assertEquals(URI("$HTTPS_EXAMPLE_COM/rol/d31cd83f-11da-4932-bde8-a9123c9821d3"), result.url)
        assertEquals(UUID.fromString("d31cd83f-11da-4932-bde8-a9123c9821d3"), result.uuid)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/zaak"), result.zaak)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/betrokkene"), result.betrokkene)
        assertEquals(BetrokkeneType.NIET_NATUURLIJK_PERSOON, result.betrokkeneType)
        assertEquals(URI("$HTTPS_EXAMPLE_COM/roltype"), result.roltype)
        assertEquals("omschrijving", result.omschrijving)
        assertEquals(ZaakRolOmschrijving.INITIATOR, result.omschrijvingGeneriek)
        assertEquals("roltoelichting", result.roltoelichting)
        assertEquals(LocalDateTime.of(2019, 8, 24, 14, 15, 22), result.registratiedatum)
        assertEquals(IndicatieMachtiging.GEMACHTIGDE, result.indicatieMachtiging)

        val betrokkeneIdentificatie = result.betrokkeneIdentificatie as RolNietNatuurlijkPersoon
        assertEquals("annIdentificatie", betrokkeneIdentificatie.annIdentificatie)
        assertEquals("innNnpId", betrokkeneIdentificatie.innNnpId)
        assertEquals("statutaireNaam", betrokkeneIdentificatie.statutaireNaam)
        assertEquals("besloten_vennootschap", betrokkeneIdentificatie.innRechtsvorm)
        assertEquals("bezoekadres", betrokkeneIdentificatie.bezoekadres)
    }

    @Test
    fun `should send outbox message on creating zaakrol`() {
        val client = zakenApiClient()

        val responseBody = """
            {
              "url": "$HTTPS_EXAMPLE_COM/rol/d31cd83f-11da-4932-bde8-a9123c9821d3",
              "uuid": "d31cd83f-11da-4932-bde8-a9123c9821d3",
              "zaak": "$HTTPS_EXAMPLE_COM/zaak",
              "betrokkene": "$HTTPS_EXAMPLE_COM/betrokkene",
              "betrokkeneType": "niet_natuurlijk_persoon",
              "roltype": "$HTTPS_EXAMPLE_COM/roltype",
              "omschrijving": "omschrijving",
              "omschrijvingGeneriek": "initiator",
              "roltoelichting": "roltoelichting",
              "registratiedatum": "2019-08-24T14:15:22Z",
              "indicatieMachtiging": "gemachtigde",
              "betrokkeneIdentificatie": {
                "annIdentificatie": "annIdentificatie",
                "innNnpId": "innNnpId",
                "statutaireNaam": "statutaireNaam",
                "innRechtsvorm": "besloten_vennootschap",
                "bezoekadres": "bezoekadres"
              }
            }
        """.trimIndent()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.createZaakRol(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            rol = Rol(
                zaak = URI("$HTTPS_EXAMPLE_COM/zaak"),
                betrokkeneType = BetrokkeneType.NIET_NATUURLIJK_PERSOON,
                roltype = URI("$HTTPS_EXAMPLE_COM/roltype"),
                roltoelichting = "test",
                betrokkeneIdentificatie = RolNietNatuurlijkPersoon(
                    annIdentificatie = "annIdentificatie"
                )
            )
        )

        mockApi.takeRequest()

        verify(outboxService).send(eventCapture.capture())

        val firstEventValue = eventCapture.firstValue.get()
        val mappedFirstEventResult: Rol = objectMapper.readValue(firstEventValue.result.toString())

        assertThat(firstEventValue).isInstanceOf(ZaakRolCreated::class.java)
        assertThat(result.url.toString()).isEqualTo(firstEventValue.resultId.toString())
        assertThat(result.omschrijving).isEqualTo(mappedFirstEventResult.omschrijving)
    }

    @Test
    fun `should not send outbox message on failing to create zaakrol`() {
        val client = zakenApiClient()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        assertThrows<HttpClientErrorException> {
            client.createZaakRol(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                rol = Rol(
                    zaak = URI("$HTTPS_EXAMPLE_COM/zaak"),
                    betrokkeneType = BetrokkeneType.NIET_NATUURLIJK_PERSOON,
                    roltype = URI("$HTTPS_EXAMPLE_COM/roltype"),
                    roltoelichting = "test",
                    betrokkeneIdentificatie = RolNietNatuurlijkPersoon(
                        annIdentificatie = "annIdentificatie"
                    )
                )
            )
        }

        mockApi.takeRequest()

        verify(applicationEventPublisher, times(0)).publishEvent(anyVararg(ZaakRolCreated::class))
        verify(outboxService, times(0)).send(eventCapture.capture())
    }

    @Test
    fun `should send outbox message on creating zaak`() {
        val client = zakenApiClient()

        val responseBody = """
            {
                "url": "$HTTPS_EXAMPLE_COM",
                "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                "bronorganisatie": "002564440",
                "zaaktype": "$HTTPS_EXAMPLE_COM",
                "verantwoordelijkeOrganisatie": "002564440",
                "startdatum": "2019-08-24"
            }
        """.trimIndent()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.createZaak(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            request = CreateZaakRequest(
                bronorganisatie = Rsin("002564440"),
                zaaktype = exampleUri(),
                startdatum = LocalDate.of(2019, 8, 24),
                verantwoordelijkeOrganisatie = Rsin("002564440")
            )
        )

        mockApi.takeRequest()

        verify(outboxService).send(eventCapture.capture())
        verify(applicationEventPublisher).publishEvent(anyVararg(ZaakCreated::class))

        val firstEventValue = eventCapture.firstValue.get()
        val mappedFirstEventResult: CreateZaakResponse = objectMapper.readValue(firstEventValue.result.toString())

        assertThat(firstEventValue).isInstanceOf(ZaakCreated::class.java)
        assertThat(result.url.toString()).isEqualTo(firstEventValue.resultId)
        assertThat(result.bronorganisatie).isEqualTo(mappedFirstEventResult.bronorganisatie)
    }

    @Test
    fun `should send outbox message on creating zaakstatus`() {
        val zaakUrl = zaakUri()
        val client = zakenApiClient()

        val responseBody = """
            {
                "url": "$HTTPS_EXAMPLE_COM",
                "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                "zaak": "$zaakUrl",
                "statustype": "$HTTPS_EXAMPLE_COM",
                "statustoelichting": "test",
                "datumStatusGezet": "2018-07-14T17:45:55.9483536"
            }
        """.trimIndent()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.createZaakStatus(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            request = CreateZaakStatusRequest(
                zaak = zaakUrl,
                datumStatusGezet = LocalDateTime.of(2023, 8, 3, 3, 3),
                statustype = exampleUri()
            )
        )

        mockApi.takeRequest()

        verify(outboxService).send(eventCapture.capture())

        val firstEventValue = eventCapture.firstValue.get()
        val mappedFirstEventResult: CreateZaakStatusResponse = objectMapper.readValue(firstEventValue.result.toString())

        assertThat(firstEventValue).isInstanceOf(ZaakStatusCreated::class.java)
        assertThat(result.url.toString()).isEqualTo(firstEventValue.resultId)
        assertThat(result.statustoelichting).isEqualTo(mappedFirstEventResult.statustoelichting)
    }

    @Test
    fun `should not send outbox message on failing to create zaakstatus`() {
        val client = zakenApiClient()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        assertThrows<HttpClientErrorException> {
            client.createZaakStatus(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                request = CreateZaakStatusRequest(
                    zaak = zaakUri(),
                    datumStatusGezet = LocalDateTime.of(2023, 8, 3, 3, 3),
                    statustype = exampleUri()
                )
            )
        }

        mockApi.takeRequest()

        verify(outboxService, times(0)).send(eventCapture.capture())
    }

    @Test
    fun `should send outbox message on creating zaakresultaat`() {
        val client = zakenApiClient()

        val responseBody = """
            {
                "url": "$HTTPS_EXAMPLE_COM",
                "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                "zaak": "${zaakUri()}",
                "resultaattype": "$HTTPS_EXAMPLE_COM",
                "toelichting": "test"
            }
        """.trimIndent()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.createZaakResultaat(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            request = CreateZaakResultaatRequest(
                zaak = zaakUri(),
                resultaattype = exampleUri(),
            )
        )

        mockApi.takeRequest()

        verify(applicationEventPublisher).publishEvent(anyVararg(ZaakResultaatCreated::class))
        verify(outboxService).send(eventCapture.capture())

        val firstEventValue = eventCapture.firstValue.get()
        val mappedFirstEventResult: CreateZaakResultaatResponse =
            objectMapper.readValue(firstEventValue.result.toString())

        assertThat(firstEventValue).isInstanceOf(ZaakResultaatCreated::class.java)
        assertThat(result.url.toString()).isEqualTo(firstEventValue.resultId)
        assertThat(result.toelichting).isEqualTo(mappedFirstEventResult.toelichting)
    }

    @Test
    fun `should not send outbox message on failing to create zaakresultaat`() {
        val client = zakenApiClient()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        assertThrows<HttpClientErrorException> {
            client.createZaakResultaat(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                request = CreateZaakResultaatRequest(
                    zaak = zaakUri(),
                    resultaattype = exampleUri(),
                )
            )
        }

        mockApi.takeRequest()

        verify(applicationEventPublisher, times(0)).publishEvent(anyVararg(ZaakResultaatCreated::class))
        verify(outboxService, times(0)).send(eventCapture.capture())
    }

    @Test
    fun `should send outbox message on setting zaak opschorting`() {
        val client = zakenApiClient()

        val responseBody = """
            {
                "url": "$HTTPS_EXAMPLE_COM",
                "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                "bronorganisatie": "002564440",
                "zaaktype": "$HTTPS_EXAMPLE_COM",
                "verantwoordelijkeOrganisatie": "002564440",
                "omschrijving": "test",
                "toelichting": "test",
                "registratiedatum": "2019-08-24",
                "startdatum": "2019-08-24",
                "communicatiekanaal": "test",
                "identificatie": "test",
                "productenOfDiensten": ["test"],
                "vertrouwelijkheidaanduiding": "test",
                "betalingsindicatie": "test",
                "betalingsindicatieWeergave": "test",
                "selectielijstklasse": "test",
                "deelzaken": ["test"],
                "relevanteAndereZaken": ["test"],
                "eigenschappen": ["test"],
                "kenmerken": ["test"],
                "archiefstatus": "test",
                "opdrachtgevendeOrganisatie": "002564440",
                "opschorting": {
                    "indicatie": true,
                    "reden": "test"
                }
            }
        """.trimIndent()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.setZaakOpschorting(
            authentication = TestAuthentication(),
            url = zakenApiBaseUri(),
            request = ZaakopschortingRequest(
                verlenging = Verlenging(
                    reden = "test",
                    duur = "test"
                ),
                opschorting = Opschorting(
                    indicatie = true,
                    reden = "test"
                )
            )
        )

        mockApi.takeRequest()

        verify(outboxService).send(eventCapture.capture())

        val firstEventValue = eventCapture.firstValue.get()
        val mappedFirstEventResult: ZaakopschortingResponse = objectMapper.readValue(firstEventValue.result.toString())

        assertThat(firstEventValue).isInstanceOf(ZaakOpschortingUpdated::class.java)
        assertThat(result.url).isEqualTo(firstEventValue.resultId)
        assertThat(result.opschorting?.reden).isEqualTo(mappedFirstEventResult.opschorting?.reden)
    }

    @Test
    fun `should not send outbox message on failing to set zaak opschorting`() {
        val client = zakenApiClient()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        assertThrows<HttpClientErrorException> {
            client.setZaakOpschorting(
                authentication = TestAuthentication(),
                url = zakenApiBaseUri(),
                request = ZaakopschortingRequest(
                    verlenging = Verlenging(
                        reden = "test",
                        duur = "test"
                    ),
                    opschorting = Opschorting(
                        indicatie = true,
                        reden = "test"
                    )
                )
            )
        }

        mockApi.takeRequest()

        verify(outboxService, times(0)).send(eventCapture.capture())
    }

    @Test
    fun `should send outbox message on retrieving zaak`() {
        val client = zakenApiClient()

        val responseBody = """
            {
                "url": "$HTTPS_EXAMPLE_COM",
                "uuid": "095be615-a8ad-4c33-8e9c-c7612fbf6c9f",
                "bronorganisatie": "002564440",
                "zaaktype": "$HTTPS_EXAMPLE_COM",
                "verantwoordelijkeOrganisatie": "002564440",
                "omschrijving": "test",
                "toelichting": "test",
                "registratiedatum": "2019-08-24",
                "startdatum": "2019-08-24",
                "communicatiekanaal": "test",
                "identificatie": "test",
                "productenOfDiensten": ["test"],
                "betalingsindicatie": "test",
                "betalingsindicatieWeergave": "test",
                "selectielijstklasse": "test",
                "deelzaken": ["test"],
                "relevanteAndereZaken": [{"url": "$HTTPS_EXAMPLE_COM", "aardRelatie": "overig"}],
                "eigenschappen": ["test"],
                "kenmerken": [{"kenmerk": "test", "bron": "test"}],
                "archiefstatus": "gearchiveerd",
                "opdrachtgevendeOrganisatie": "002564440",
                "vertrouwelijkheidaanduiding": "intern",
                "opschorting": {
                    "indicatie": true,
                    "reden": "test"
                }
            }
        """.trimIndent()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.getZaak(
            authentication = TestAuthentication(),
            zaakUrl = zakenApiBaseUri(),
        )

        mockApi.takeRequest()

        verify(outboxService).send(eventCapture.capture())

        val firstEventValue = eventCapture.firstValue.get()
        val mappedFirstEventResult: ZaakResponse = objectMapper.readValue(firstEventValue.result.toString())

        assertThat(firstEventValue).isInstanceOf(ZaakViewed::class.java)
        assertThat(result.url.toString()).isEqualTo(firstEventValue.resultId)
        assertThat(result.toelichting).isEqualTo(mappedFirstEventResult.toelichting)
    }

    @Test
    fun `should not send outbox message on failing to retrieve zaak`() {
        val client = zakenApiClient()

        val eventCapture = argumentCaptor<Supplier<BaseEvent>>()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        assertThrows<HttpClientErrorException> {
            client.getZaak(
                authentication = TestAuthentication(),
                zaakUrl = zakenApiBaseUri(),
            )
        }

        mockApi.takeRequest()

        verify(outboxService, times(0)).send(eventCapture.capture())
    }

    @Test
    fun `should send get zaaknotities request and parse response`() {
        val zaakUrl = zaakUri()

        val client = zakenApiClient()

        val responseBody = """
            {
              "count": 2,
              "next": null,
              "previous": null,
              "results": [
                {
                  "url": "${zaakNotitieUri("0105bd5b-4c92-4fb2-9cb8-aa5b041ac776")}",
                  "onderwerp": "Onderwerp 1",
                  "tekst": "Tekst 1",
                  "aangemaaktDoor": "jan",
                  "notitieType": "intern",
                  "status": "concept",
                  "aanmaakdatum": "2024-01-01T10:00:00",
                  "wijzigingsdatum": "2024-01-01T10:00:00",
                  "gerelateerdAan": "$zaakUrl"
                },
                {
                  "url": "${zaakNotitieUri("6f394e5d-ee7e-4c2f-b85a-b84220f29063")}",
                  "onderwerp": "Onderwerp 2",
                  "tekst": "Tekst 2",
                  "aangemaaktDoor": "jaap",
                  "notitieType": "extern",
                  "status": "definitief",
                  "aanmaakdatum": "2024-01-02T11:00:00",
                  "wijzigingsdatum": "2024-01-02T11:00:00",
                  "gerelateerdAan": "$zaakUrl"
                }
              ]
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.getZaakNotities(
            authentication = TestAuthentication(),
            baseUrl = zakenApiBaseUri(),
            zaakUrl = zaakUrl,
            page = 1
        )

        mockApi.takeRequest().requestUrl!!.let { requestUrl ->
            assertThat(requestUrl.queryParameter("zaak")).isEqualTo(zaakUrl.toASCIIString())
            assertThat(requestUrl.queryParameter("page")).isEqualTo("1")
        }
        assertThat(result.count).isEqualTo(2)
        assertThat(result.results[0].onderwerp).isEqualTo("Onderwerp 1")
        assertThat(result.results[1].notitieType?.key).isEqualTo("extern")
        assertThat(result.results[1].status?.key).isEqualTo("definitief")
    }

    @Test
    fun `should send outbox message on retrieving zaaknotities`() {
        val zaakUrl = zaakUri()
        val client = zakenApiClient()

        val responseBody = """
            {
              "count": 1,
              "next": null,
              "previous": null,
              "results": [
                {
                  "url": "${zaakNotitieUri()}",
                  "onderwerp": "Onderwerp",
                  "tekst": "Tekst",
                  "aangemaaktDoor": "jan",
                  "notitieType": "intern",
                  "status": "concept",
                  "aanmaakdatum": "2024-01-01T10:00:00",
                  "wijzigingsdatum": "2024-01-01T10:00:00",
                  "gerelateerdAan": "$zaakUrl"
                }
              ]
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        argumentCaptor<Supplier<BaseEvent>> {
            val result = client.getZaakNotities(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                zaakUrl = zaakUrl,
                page = 1
            )

            mockApi.takeRequest()

            verify(outboxService).send(capture())

            firstValue.get().let { event ->
                assertThat(event).isInstanceOf(ZaakNotitiesListed::class.java)
                objectMapper.readValue<List<ZaakNotitie>>(event.result.toString()).let { zaakNotities ->
                    assertThat(zaakNotities.first().onderwerp).isEqualTo(result.results.first().onderwerp)
                }
            }
        }
    }

    @Test
    fun `should not send outbox message on failing to retrieve zaaknotities`() {
        val client = zakenApiClient()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        assertThrows<HttpClientErrorException> {
            client.getZaakNotities(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                zaakUrl = zaakUri(),
                page = 1
            )
        }

        mockApi.takeRequest()

        verify(outboxService, times(0)).send(any())
    }

    @Test
    fun `should send get zaaknotitie request and parse response`() {
        val zaakUrl = zaakUri()
        val zaakNotitieUrl = zaakNotitieUri()

        val client = zakenApiClient()

        val responseBody = """
            {
              "url": "$zaakNotitieUrl",
              "onderwerp": "Onderwerp",
              "tekst": "Tekst",
              "aangemaaktDoor": "jan",
              "notitieType": "intern",
              "status": "concept",
              "aanmaakdatum": "2024-01-01T10:00:00",
              "wijzigingsdatum": "2024-01-01T10:00:00",
              "gerelateerdAan": "$zaakUrl"
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        val result = client.getZaakNotitie(
            authentication = TestAuthentication(),
            zaakNotitieUrl = zaakNotitieUrl
        )

        mockApi.takeRequest()

        assertThat(result.onderwerp).isEqualTo("Onderwerp")
        assertThat(result.notitieType?.key).isEqualTo("intern")
        assertThat(result.status?.key).isEqualTo("concept")
    }

    @Test
    fun `should send outbox message on retrieving zaaknotitie`() {
        val zaakUrl = zaakUri()
        val zaakNotitieUrl = zaakNotitieUri()

        val client = zakenApiClient()

        val responseBody = """
            {
              "url": "$zaakNotitieUrl",
              "onderwerp": "Onderwerp",
              "tekst": "Tekst",
              "aangemaaktDoor": "jan",
              "notitieType": "extern",
              "status": "definitief",
              "aanmaakdatum": "2024-01-02T11:00:00",
              "wijzigingsdatum": "2024-01-02T11:00:00",
              "gerelateerdAan": "$zaakUrl"
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        argumentCaptor<Supplier<BaseEvent>> {
            val result = client.getZaakNotitie(
                authentication = TestAuthentication(),
                zaakNotitieUrl = zaakNotitieUrl
            )

            mockApi.takeRequest()

            verify(outboxService).send(capture())

            firstValue.get().let { event ->
                assertThat(event).isInstanceOf(ZaakNotitieViewed::class.java)
                objectMapper.readValue<ZaakNotitie>(event.result.toString()).let { zaakNotitie ->
                    assertThat(zaakNotitie.onderwerp).isEqualTo(result.onderwerp)
                }
            }
        }
    }

    @Test
    fun `should not send outbox message on failing to retrieve zaaknotitie`() {
        val client = zakenApiClient()

        mockApi.enqueue(mockResponse("").setResponseCode(400))

        assertThrows<HttpClientErrorException> {
            client.getZaakNotitie(
                authentication = TestAuthentication(),
                zaakNotitieUrl = zaakNotitieUri()
            )
        }

        mockApi.takeRequest()

        verify(outboxService, times(0)).send(any())
    }

    @Test
    fun `should send outbox message on creating zaaknotitie`() {
        val client = zakenApiClient()

        val responseBody = """
            {
              "url": "${zaakNotitieUri()}",
              "onderwerp": "Onderwerp",
              "tekst": "Tekst",
              "aangemaaktDoor": "jan",
              "notitieType": "intern",
              "status": "concept",
              "aanmaakdatum": "2024-01-01T10:00:00",
              "wijzigingsdatum": "2024-01-01T10:00:00",
              "gerelateerdAan": "$HTTPS_EXAMPLE_COM/zaken/1"
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        argumentCaptor<Supplier<BaseEvent>> {
            val result = client.createZaakNotitie(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                request = CreateZaakNotitieRequest(
                    onderwerp = "Onderwerp",
                    tekst = "Tekst",
                    gerelateerdAan = zaakUri(),
                    aangemaaktDoor = "jan",
                    notitieType = NotitieType.INTERN,
                    status = NotitieStatus.CONCEPT
                )
            )

            mockApi.takeRequest()

            verify(applicationEventPublisher).publishEvent(anyVararg(ZaakNotitieCreated::class))
            verify(outboxService).send(capture())

            firstValue.get().let { event ->
                assertThat(event).isInstanceOf(ZaakNotitieCreated::class.java)
                assertThat(result.url.toString()).isEqualTo(event.resultId)
                objectMapper.readValue<ZaakNotitie>(event.result.toString()).let { zaakNotitie ->
                    assertThat(zaakNotitie.onderwerp).isEqualTo(result.onderwerp)
                }
            }
        }
    }

    @Test
    fun `should validate host when creating zaaknotitie`() {
        val client = zakenApiClient()

        assertThrows<IllegalArgumentException> {
            client.createZaakNotitie(
                authentication = TestAuthentication(),
                baseUrl = URI("https://api.example.com"),
                request = CreateZaakNotitieRequest(
                    onderwerp = "Onderwerp",
                    tekst = "Tekst",
                    gerelateerdAan = zaakUri()
                )
            )
        }
    }

    @Test
    fun `should send outbox message on patching zaaknotitie`() {
        val zaakNotitieUrl = zaakNotitieUri()
        val client = zakenApiClient()

        val responseBody = """
            {
              "url": "$zaakNotitieUrl",
              "onderwerp": "Onderwerp nieuw",
              "tekst": "Tekst",
              "aangemaaktDoor": "jan",
              "notitieType": "intern",
              "status": "concept",
              "aanmaakdatum": "2024-01-01T10:00:00",
              "wijzigingsdatum": "2024-01-01T12:00:00",
              "gerelateerdAan": "${zaakUri()}"
            }
        """.trimIndent()

        mockApi.enqueue(mockResponse(responseBody))

        argumentCaptor<Supplier<BaseEvent>> {
            val result = client.patchZaakNotitie(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                notitieUrl = zaakNotitieUrl,
                request = PatchZaakNotitieRequest(
                    onderwerp = "Onderwerp nieuw"
                )
            )
            mockApi.takeRequest()

            verify(applicationEventPublisher).publishEvent(anyVararg(ZaakNotitiePatched::class))
            verify(outboxService).send(capture())

            firstValue.get().let { event ->
                assertThat(event).isInstanceOf(ZaakNotitiePatched::class.java)

                objectMapper.readValue<ZaakNotitie>(event.result.toString()).let { zaakNotitie ->
                    assertThat(result.tekst).isEqualTo(zaakNotitie.tekst)
                }
            }
        }
    }

    @Test
    fun `should validate host when patching zaaknotitie`() {
        val client = zakenApiClient()

        assertThrows<IllegalArgumentException> {
            client.patchZaakNotitie(
                authentication = TestAuthentication(),
                baseUrl = URI("https://api1.example.com"),
                notitieUrl = URI("https://api2.example.com/zaaknotities/1"),
                request = PatchZaakNotitieRequest(
                    onderwerp = "x"
                )
            )
        }
    }

    @Test
    fun `should validate host when patching zaaknotitie gerelateerd aan`() {
        val client = zakenApiClient()

        assertThrows<IllegalArgumentException> {
            client.patchZaakNotitie(
                authentication = TestAuthentication(),
                baseUrl = zakenApiBaseUri(),
                notitieUrl = zaakNotitieUri(),
                request = PatchZaakNotitieRequest(
                    gerelateerdAan = URI("https://api2.example.com/zaak/a82467dc-0090-48bc-a46d-c4f8923d6f15")
                )
            )
        }
    }

    private fun zakenApiClient() = ZakenApiClient(
        restClientBuilder = restClientBuilder,
        outboxService = outboxService,
        objectMapper = objectMapper,
        authorizationService = authorizationService,
        applicationEventPublisher = applicationEventPublisher
    )

    private fun zaakUri(id: String = "1100e54b-51e5-4f7c-a27d-54761bfc5b82") =
        zakenApiBaseUri("/zaken/$id")

    private fun zaakNotitieUri(id: String = "396ef930-7f6b-49e0-bb3a-4905458ba63e") =
        zakenApiBaseUri("/zaaknotities/$id")

    private fun zakenApiBaseUri(path: String = "/") = mockApi.url(path).toUri()

    private fun exampleUri() = URI(HTTPS_EXAMPLE_COM)

    private fun mockResponse(body: String): MockResponse {
        return MockResponse()
            .addHeader("Content-Type", "application/json")
            .setBody(body)
    }

    class TestAuthentication : ZakenApiAuthentication {
        override fun applyAuth(builder: RestClient.Builder): RestClient.Builder {
            return builder.defaultHeaders { headers ->
                headers.setBearerAuth("test")
            }
        }

        override fun filter(request: ClientRequest, next: ExchangeFunction): Mono<ClientResponse> {
            val filteredRequest = ClientRequest.from(request).headers { headers ->
                headers.setBearerAuth("test")
            }.build()
            return next.exchange(filteredRequest)
        }
    }

    companion object {
        private const val HTTPS_EXAMPLE_COM = "https://example.com"
    }
}
