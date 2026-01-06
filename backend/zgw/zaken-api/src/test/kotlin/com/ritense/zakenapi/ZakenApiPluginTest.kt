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

package com.ritense.zakenapi

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.documentenapi.web.rest.dto.RelatedFileDto
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.ritense.plugin.service.PluginService
import com.ritense.resource.service.TemporaryResourceStorageService
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valueresolver.ValueResolverService
import com.ritense.zakenapi.ZakenApiPlugin.Companion.DOCUMENT_URL_PROCESS_VAR
import com.ritense.zakenapi.ZakenApiPlugin.Companion.RESOURCE_ID_PROCESS_VAR
import com.ritense.zakenapi.client.LinkDocumentRequest
import com.ritense.zakenapi.client.ZakenApiClient
import com.ritense.zakenapi.domain.Betalingsindicatie
import com.ritense.zakenapi.domain.CreateZaakRequest
import com.ritense.zakenapi.domain.CreateZaakResultaatRequest
import com.ritense.zakenapi.domain.CreateZaakStatusRequest
import com.ritense.zakenapi.domain.CreateZaakeigenschapRequest
import com.ritense.zakenapi.domain.Geometry
import com.ritense.zakenapi.domain.GeometryType
import com.ritense.zakenapi.domain.PatchZaakRequest
import com.ritense.zakenapi.domain.UpdateZaakeigenschapRequest
import com.ritense.zakenapi.domain.ZaakHersteltermijn
import com.ritense.zakenapi.domain.ZaakInstanceLink
import com.ritense.zakenapi.domain.ZaakObject
import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zakenapi.domain.ZaakbesluitResponse
import com.ritense.zakenapi.domain.ZaakeigenschapResponse
import com.ritense.zakenapi.domain.ZaakopschortingRequest
import com.ritense.zakenapi.domain.rol.Rol
import com.ritense.zakenapi.domain.rol.RolNatuurlijkPersoon
import com.ritense.zakenapi.domain.rol.RolNietNatuurlijkPersoon
import com.ritense.zakenapi.domain.zaakobjectrequest.ZaakObjectRequest
import com.ritense.zakenapi.repository.ZaakHersteltermijnRepository
import com.ritense.zakenapi.repository.ZaakInstanceLinkRepository
import com.ritense.zakenapi.service.ZaakDocumentService
import com.ritense.zgw.Page
import com.ritense.zgw.Rsin
import java.net.URI
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.assertj.core.api.Assertions.assertThat
import org.camunda.bpm.engine.delegate.DelegateExecution
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.transaction.PlatformTransactionManager

internal class ZakenApiPluginTest {

    @Test
    fun `should link document to zaak`() {
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(any())).thenReturn(URI("https://zaak.url"))

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        plugin.linkDocumentToZaak(executionMock, "https://document.url", "titel", "beschrijving")

        val captor = argumentCaptor<LinkDocumentRequest>()
        verify(zakenApiClient).linkDocument(any(), any(), captor.capture())

        val request = captor.firstValue
        assertEquals("https://document.url", request.informatieobject)
        assertEquals("https://zaak.url", request.zaak)
        assertEquals("titel", request.titel)
        assertEquals("beschrijving", request.beschrijving)
    }

    @Test
    fun `should link uploaded document to zaak`() {
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val storageService: TemporaryResourceStorageService = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(executionMock.getVariable(DOCUMENT_URL_PROCESS_VAR)).thenReturn("https://document.url")
        whenever(executionMock.getVariable(RESOURCE_ID_PROCESS_VAR)).thenReturn("myResourceId")
        whenever(zaakUrlProvider.getZaakUrl(any())).thenReturn(URI("https://zaak.url"))
        whenever(zakenApiClient.linkDocument(any(), any(), any())).thenReturn(mock())
        whenever(storageService.getResourceMetadata("myResourceId")).thenReturn(
            mapOf(
                "title" to "titel",
                "description" to "beschrijving",
            )
        )

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            storageService = storageService,
            authenticationMock = authenticationMock
        )

        plugin.linkUploadedDocumentToZaak(executionMock)

        val captor = argumentCaptor<LinkDocumentRequest>()
        verify(zakenApiClient).linkDocument(any(), any(), captor.capture())

        val request = captor.firstValue
        assertEquals("https://document.url", request.informatieobject)
        assertEquals("https://zaak.url", request.zaak)
        assertEquals("titel", request.titel)
        assertEquals("beschrijving", request.beschrijving)
    }

    @Test
    fun `should return list of zaakobjecten`() {
        val zakenApiClient: ZakenApiClient = mock()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val resultPage = Page(
            2,
            null,
            null,
            listOf<ZaakObject>(
                mock(),
                mock()
            )
        )

        whenever(
            zakenApiClient.getZaakObjecten(
                authenticationMock,
                URI("https://zaken.plugin.url"),
                URI("https://example.org"),
                1
            )
        ).thenReturn(resultPage)

        val plugin = zakenApiPlugin(
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        val zaakUrl = URI("https://example.org")
        val zaakObjecten = plugin.getZaakObjecten(zaakUrl)

        assertEquals(2, zaakObjecten.size)
    }

    @Test
    fun `should return full list of zaakobjecten when multiple pages are found`() {
        val zakenApiClient: ZakenApiClient = mock()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val firstResultPage = Page(
            2,
            URI("https://zaken.plugin.url/zaken/api/v1/zaakobjecten?page=2"),
            null,
            listOf<ZaakObject>(
                mock(),
                mock()
            )
        )
        val secondResultPage = Page(
            1,
            null,
            URI("https://zaken.plugin.url/zaken/api/v1/zaakobjecten?page=1"),
            listOf<ZaakObject>(
                mock()
            )
        )

        whenever(
            zakenApiClient.getZaakObjecten(
                authenticationMock,
                URI("https://zaken.plugin.url"),
                URI("https://example.org"),
                1
            )
        ).thenReturn(firstResultPage)
        whenever(
            zakenApiClient.getZaakObjecten(
                authenticationMock,
                URI("https://zaken.plugin.url"),
                URI("https://example.org"),
                2
            )
        ).thenReturn(secondResultPage)

        val plugin = zakenApiPlugin(
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        val zaakUrl = URI("https://example.org")
        val zaakObjecten = plugin.getZaakObjecten(zaakUrl)

        verify(zakenApiClient, times(2)).getZaakObjecten(any(), any(), any(), any())
        assertEquals(3, zaakObjecten.size)
    }

    @Test
    fun `should return full list of zaakrollen when multiple pages are found`() {
        val zakenApiClient: ZakenApiClient = mock()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val firstResultPage = Page(
            2,
            URI("https://zaken.plugin.url/zaken/api/v1/rollen?page=2"),
            null,
            listOf<Rol>(
                mock(),
                mock()
            )
        )
        val secondResultPage = Page(
            1,
            null,
            URI("https://zaken.plugin.url/zaken/api/v1/rollen?page=1"),
            listOf<Rol>(
                mock()
            )
        )

        whenever(
            zakenApiClient.getZaakRollen(
                authenticationMock,
                URI("https://zaken.plugin.url"),
                URI("https://example.org"),
                1
            )
        ).thenReturn(firstResultPage)
        whenever(
            zakenApiClient.getZaakRollen(
                authenticationMock,
                URI("https://zaken.plugin.url"),
                URI("https://example.org"),
                2
            )
        ).thenReturn(secondResultPage)

        val plugin = zakenApiPlugin(
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        val zaakUrl = URI("https://example.org")
        val zaakRollen = plugin.getZaakRollen(zaakUrl)

        verify(zakenApiClient, times(2)).getZaakRollen(any(), any(), any(), any(), eq(null))
        assertEquals(3, zaakRollen.size)
    }

    @Test
    fun `should create zaakrol for natuurlijk persoon`() {
        val zakenApiClient: ZakenApiClient = mock()
        val executionMock = mock<DelegateExecution>()

        val plugin = zakenApiPluginAndMocksForZaakRol(
            zakenApiClient = zakenApiClient,
            executionMock = executionMock
        )

        plugin.createNatuurlijkPersoonZaakRol(
            executionMock,
            roltypeUrl(),
            "rolToelichting",
            "inpBsn",
            "anpIdentificatie",
            "inpA_nummer"
        )

        val rolCaptor = argumentCaptor<Rol>()
        verify(zakenApiClient).createZaakRol(any(), any(), rolCaptor.capture())

        val rol = rolCaptor.firstValue

        assertEquals(zaakUri(), rol.zaak)
        assertEquals(roltypeUri(), rol.roltype)
        assertEquals("rolToelichting", rol.roltoelichting)

        val betrokkeneIdentificatie = rol.betrokkeneIdentificatie as RolNatuurlijkPersoon
        assertEquals("inpBsn", betrokkeneIdentificatie.inpBsn)
        assertEquals("anpIdentificatie", betrokkeneIdentificatie.anpIdentificatie)
        assertEquals("inpA_nummer", betrokkeneIdentificatie.inpA_nummer)
    }

    @Test
    fun `should create zaakrol for niet-natuurlijk persoon`() {
        val zakenApiClient: ZakenApiClient = mock()
        val executionMock = mock<DelegateExecution>()

        val plugin = zakenApiPluginAndMocksForZaakRol(
            zakenApiClient = zakenApiClient,
            executionMock = executionMock
        )

        plugin.createNietNatuurlijkPersoonZaakRol(
            executionMock,
            roltypeUrl(),
            "rolToelichting",
            "innNnpId",
            "annIdentificatie"
        )

        val rolCaptor = argumentCaptor<Rol>()
        verify(zakenApiClient).createZaakRol(any(), any(), rolCaptor.capture())

        val rol = rolCaptor.firstValue

        assertEquals(zaakUri(), rol.zaak)
        assertEquals(roltypeUri(), rol.roltype)
        assertEquals("rolToelichting", rol.roltoelichting)

        val betrokkeneIdentificatie = rol.betrokkeneIdentificatie as RolNietNatuurlijkPersoon
        assertEquals("annIdentificatie", betrokkeneIdentificatie.annIdentificatie)
        assertEquals("innNnpId", betrokkeneIdentificatie.innNnpId)
    }


    @Test
    fun `should create zaak`() {
        val zakenApiClient: ZakenApiClient = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        val rsin = Rsin("051845623")
        val zaaktypeUrl = URI("https://example.com/zaaktype/1234")
        val description = "Omschrijving"
        val plannedEndDate = LocalDate.now().plusDays(10)
        val finalDeliveryDate = null

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(
            zakenApiClient.createZaak(
                eq(authenticationMock),
                eq(URI("https://zaken.plugin.url")),
                any()
            )
        ).thenReturn(
            ZaakResponse(
                url = URI("https://zaken.plugin.url/1234"),
                uuid = UUID.randomUUID(),
                zaaktype = zaaktypeUrl,
                bronorganisatie = rsin,
                startdatum = LocalDate.now(),
                verantwoordelijkeOrganisatie = rsin,
            )
        )

        val plugin = zakenApiPlugin(
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock,
            pluginService = pluginServiceMock()
        )

        plugin.createZaak(
            executionMock,
            rsin,
            zaaktypeUrl,
            description,
            plannedEndDate.toString(),
            finalDeliveryDate
        )

        val captor = argumentCaptor<CreateZaakRequest>()
        verify(zakenApiClient).createZaak(any(), any(), captor.capture())

        val request = captor.firstValue
        assertEquals(rsin, request.bronorganisatie)
        assertEquals(zaaktypeUrl, request.zaaktype)
        assertEquals(rsin, request.verantwoordelijkeOrganisatie)
        assertNotNull(request.startdatum)
        assertEquals(description, request.omschrijving)
        assertEquals(plannedEndDate, request.einddatumGepland)
    }

    @Test
    fun `should patch zaak`() {
        val zakenApiClient: ZakenApiClient = mock()
        val zaakInstanceLinkRepository: ZaakInstanceLinkRepository = mock()
        val executionMock: DelegateExecution = mock()
        val authenticationMock: ZakenApiAuthentication = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val storageService: TemporaryResourceStorageService = mock()
        val pluginService: PluginService = mock()
        val zaakHersteltermijnRepository: ZaakHersteltermijnRepository = mock()
        val platformTransactionManager: PlatformTransactionManager = mock()
        val valueResolverService: ValueResolverService = mock()
        val objectMapper = jacksonObjectMapper()

        val documentId = UUID.fromString("dff80fb1-e24e-4287-b168-7bb199be5d58")
        val zaakId = "f18146df-4b26-4a32-8e52-122cfa4475bd"
        val zaakUrl = zaakUri(zaakId)
        val zaakInstanceLink: ZaakInstanceLink = mock()
        val zaakResponse: ZaakResponse = mock()

        val description = "Omschrijving"
        val explantation = "Toelichting"
        val communicationChannel = communicationChannel()
        val communicationChannelName = "Communicatiekanaal Naam"
        val nowDate = LocalDate.parse("2025-07-23")
        val plannedEndDate = nowDate.plusMonths(10).toString()
        val finalDeliveryDate = nowDate.plusYears(1).toString()
        val publicationDate = nowDate.minusWeeks(2).toString()
        val paymentIndication = Betalingsindicatie.GEDEELTELIJK.key
        val lastPaymentDate = nowDate.minusWeeks(1).toString()
        val archiveActionDate = nowDate.plusYears(7).toString()
        val startDateRetentionPeriod = nowDate.plusYears(5).toString()
        val mainCase = zaakUrl("3a941618-b0f1-4a0e-a9d9-c9b25ef50eaf")
        val caseGeometryType = GeometryType.POINT.key
        val caseGeometryCoordinates = "[0.0, 1.0]"

        whenever(pluginService.getObjectMapper()).thenReturn(objectMapper)

        whenever(executionMock.businessKey)
            .thenReturn(documentId.toString())

        whenever(zaakInstanceLink.zaakInstanceUrl)
            .thenReturn(zaakUrl)

        whenever(zaakInstanceLinkRepository.findByDocumentId(eq(documentId)))
            .thenReturn(zaakInstanceLink)

        whenever(zaakResponse.url)
            .thenReturn(zaakUrl)

        whenever(
            zakenApiClient.patchZaak(
                authentication = eq(authenticationMock),
                baseUrl = eq(zakenApiUri()),
                zaakUrl = eq(zaakUrl),
                request = any<PatchZaakRequest>()
            )
        )
            .thenReturn(zaakResponse)

        val plugin = zakenApiPlugin(
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock,
            pluginService = pluginServiceMock()
        )

        plugin.patchZaak(
            execution = executionMock,
            description = description,
            explanation = explantation,
            plannedEndDate = plannedEndDate,
            finalDeliveryDate = finalDeliveryDate,
            publicationDate = publicationDate,
            communicationChannel = communicationChannel,
            communicationChannelName = communicationChannelName,
            paymentIndication = paymentIndication,
            lastPaymentDate = lastPaymentDate,
            caseGeometryType = caseGeometryType,
            caseGeometryCoordinates = caseGeometryCoordinates,
            mainCase = mainCase,
            archiveActionDate = archiveActionDate,
            startDateRetentionPeriod = startDateRetentionPeriod
        )

        val captor = argumentCaptor<PatchZaakRequest>()
        verify(zakenApiClient).patchZaak(
            authentication = any(),
            baseUrl = any(),
            zaakUrl = any(),
            request = captor.capture()
        )

        val request = captor.firstValue
        assertThat(request.omschrijving).isEqualTo(description)
        assertThat(request.toelichting).isEqualTo(explantation)
        assertThat(request.einddatumGepland).isEqualTo(plannedEndDate)
        assertThat(request.uiterlijkeEinddatumAfdoening).isEqualTo(finalDeliveryDate)
        assertThat(request.publicatiedatum).isEqualTo(publicationDate)
        assertThat(request.communicatiekanaal).isEqualTo(URI.create(communicationChannel))
        assertThat(request.communicatiekanaalNaam).isEqualTo(communicationChannelName)
        assertThat(request.betalingsindicatie).isEqualTo(Betalingsindicatie.GEDEELTELIJK)
        assertThat(request.laatsteBetaaldatum).isEqualTo(lastPaymentDate)
        assertThat(request.zaakgeometrie).isEqualTo(Geometry(GeometryType.POINT, listOf(0.0F, 1.0F)))
        assertThat(request.hoofdzaak).isEqualTo(URI.create(mainCase))
        assertThat(request.archiefactiedatum).isEqualTo(archiveActionDate)
        assertThat(request.startdatumBewaartermijn).isEqualTo(startDateRetentionPeriod)
    }

    @Test
    fun `should create zaak status`() {
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/zaken/1234")
        val statustypeUrl = URI("https://example.com/statustypen/1234")

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        plugin.setZaakStatus(executionMock, statustypeUrl, "Status description")

        val captor = argumentCaptor<CreateZaakStatusRequest>()
        verify(zakenApiClient).createZaakStatus(any(), any(), captor.capture())

        val request = captor.firstValue
        assertEquals(zaakUrl, request.zaak)
        assertEquals(statustypeUrl, request.statustype)
        assertNotNull(request.datumStatusGezet)
        assertEquals("Status description", request.statustoelichting)
    }


    @Test
    fun `should create zaak resultaat`() {
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/zaken/1234")
        val resultaattypeUrl = URI("https://example.com/resultaten/1234")

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        plugin.createZaakResultaat(executionMock, resultaattypeUrl, "Result description")

        val captor = argumentCaptor<CreateZaakResultaatRequest>()
        verify(zakenApiClient).createZaakResultaat(any(), any(), captor.capture())

        val request = captor.firstValue
        assertEquals(zaakUrl, request.zaak)
        assertEquals(resultaattypeUrl, request.resultaattype)
        assertEquals("Result description", request.toelichting)
    }

    @Test
    fun `should update zaakopschorting and verlenging`() {

        // given
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/zaken/1234")

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        // when
        plugin.setZaakOpschorting(
            execution = executionMock,
            verlengingsduur = "P3Y",
            toelichtingVerlenging = "testing verlenging",
            toelichtingOpschorting = "testing opschorting"
        )

        // then
        val captor = argumentCaptor<ZaakopschortingRequest>()
        verify(zakenApiClient).setZaakOpschorting(any(), any(), captor.capture())

        val request = captor.firstValue
        assertTrue(request.opschorting.indicatie)
        assertEquals("testing verlenging", request.verlenging.reden)
        assertEquals("testing opschorting", request.opschorting.reden)
    }

    @Test
    fun `should start hersteltermijn`() {

        // given
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/zaken/1234")

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(zakenApiClient.getZaak(authenticationMock, zaakUrl))
            .thenReturn(
                ZaakResponse(
                    uuid = UUID.randomUUID(),
                    url = zaakUrl,
                    bronorganisatie = Rsin("051845623"),
                    startdatum = LocalDate.now(),
                    verantwoordelijkeOrganisatie = Rsin("051845623"),
                    zaaktype = URI("www.ritense.com"),
                    uiterlijkeEinddatumAfdoening = LocalDate.parse("2050-01-01")
                )
            )

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        // when
        plugin.startHersteltermijn(
            execution = executionMock,
            maxDurationInDays = 14
        )

        // then
        val captor = argumentCaptor<PatchZaakRequest>()
        verify(zakenApiClient).patchZaak(any(), any(), any(), captor.capture())

        val request = captor.firstValue
        assertEquals(LocalDate.parse("2050-01-15"), request.uiterlijkeEinddatumAfdoening)
        assertTrue(request.opschorting!!.indicatie)
        assertEquals("hersteltermijn", request.opschorting?.reden)
    }

    @Test
    fun `should not start hersteltermijn twice`() {

        // given
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val zaakHersteltermijnRepository: ZaakHersteltermijnRepository = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/zaken/1234")

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(zakenApiClient.getZaak(authenticationMock, zaakUrl))
            .thenReturn(
                ZaakResponse(
                    uuid = UUID.randomUUID(),
                    url = zaakUrl,
                    bronorganisatie = Rsin("051845623"),
                    startdatum = LocalDate.now(),
                    verantwoordelijkeOrganisatie = Rsin("051845623"),
                    zaaktype = URI("www.ritense.com"),
                    uiterlijkeEinddatumAfdoening = LocalDate.parse("2050-01-01")
                )
            )
        whenever(zaakHersteltermijnRepository.findByZaakUrlAndEndDateIsNull(zaakUrl))
            .thenReturn(ZaakHersteltermijn(UUID.randomUUID(), zaakUrl, LocalDate.now(), null, 12))

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            zaakHersteltermijnRepository = zaakHersteltermijnRepository,
            authenticationMock = authenticationMock
        )

        assertEquals(
            "Hersteltermijn already exists for zaak 'https://example.com/zaken/1234'",
            assertThrows<IllegalArgumentException> {
                plugin.startHersteltermijn(
                    execution = executionMock,
                    maxDurationInDays = 14
                )
            }.message
        )
    }

    @Test
    fun `should end hersteltermijn`() {

        // given
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val zaakHersteltermijnRepository: ZaakHersteltermijnRepository = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/zaken/1234")

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(zakenApiClient.getZaak(authenticationMock, zaakUrl))
            .thenReturn(
                ZaakResponse(
                    uuid = UUID.randomUUID(),
                    url = zaakUrl,
                    bronorganisatie = Rsin("051845623"),
                    startdatum = LocalDate.now().minusDays(50),
                    verantwoordelijkeOrganisatie = Rsin("051845623"),
                    zaaktype = URI("www.ritense.com"),
                    uiterlijkeEinddatumAfdoening = LocalDate.now().plusDays(50)
                )
            )
        whenever(zaakHersteltermijnRepository.findByZaakUrlAndEndDateIsNull(zaakUrl)).thenReturn(
            ZaakHersteltermijn(
                zaakUrl = zaakUrl,
                startDate = LocalDate.now().minusDays(8),
                endDate = null,
                maxDurationInDays = 17
            )
        )

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            zaakHersteltermijnRepository = zaakHersteltermijnRepository,
            authenticationMock = authenticationMock
        )

        // when
        plugin.endHersteltermijn(
            execution = executionMock
        )

        // then
        val captor = argumentCaptor<PatchZaakRequest>()
        verify(zakenApiClient).patchZaak(any(), any(), any(), captor.capture())

        val request = captor.firstValue
        assertEquals(LocalDate.now().plusDays(50 - 17 + 8), request.uiterlijkeEinddatumAfdoening)
        assertFalse(request.opschorting!!.indicatie)
        assertEquals("", request.opschorting?.reden)
    }

    @Test
    fun `should create zaakeigenschap`() {

        // given
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/zaken/1234")
        val eigenschapUrl = URI("https://example.com/eigenschappen/7890")

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(zakenApiClient.createZaakeigenschap(any(), any(), any()))
            .thenReturn(
                ZaakeigenschapResponse(
                    url = URI("https://example.com/zaken/1234/zaakeigenschappen/5678"),
                    zaak = zaakUrl,
                    eigenschap = eigenschapUrl,
                    waarde = "test-value"
                )
            )

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        // when
        plugin.createZaakeigenschap(
            execution = executionMock,
            eigenschapUrl = eigenschapUrl,
            eigenschapValue = "test-value"
        )

        // then
        val captor = argumentCaptor<CreateZaakeigenschapRequest>()
        verify(zakenApiClient).createZaakeigenschap(any(), any(), captor.capture())

        val request = captor.firstValue
        assertEquals(zaakUrl, request.zaak)
        assertEquals(eigenschapUrl, request.eigenschap)
        assertEquals("test-value", request.waarde)
    }

    @Test
    fun `should update zaakeigenschap`() {

        // given
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/zaken/1234")
        val eigenschapUrl = URI("https://example.com/eigenschappen/7890")

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(zakenApiClient.getZaakeigenschappen(any(), any(), any()))
            .thenReturn(
                listOf(
                    ZaakeigenschapResponse(
                        url = URI("https://example.com/zaken/1234/zaakeigenschappen/5678"),
                        zaak = zaakUrl,
                        eigenschap = eigenschapUrl,
                        waarde = "test-value"
                    )
                )
            )

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        // when
        plugin.updateZaakeigenschap(
            execution = executionMock,
            eigenschapUrl = eigenschapUrl,
            eigenschapValue = "test-value-updated"
        )

        // then
        val captor = argumentCaptor<UpdateZaakeigenschapRequest>()
        verify(zakenApiClient).updateZaakeigenschap(any(), any(), any(), captor.capture())

        val request = captor.firstValue
        assertEquals(zaakUrl, request.zaak)
        assertEquals(eigenschapUrl, request.eigenschap)
        assertEquals("test-value-updated", request.waarde)
    }

    @Test
    fun `should delete zaakeigenschap`() {

        // given
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val executionMock = mock<DelegateExecution>()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/zaken/1234")
        val eigenschapUrl = URI("https://example.com/eigenschappen/7890")

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(zakenApiClient.getZaakeigenschappen(any(), any(), any()))
            .thenReturn(
                listOf(
                    ZaakeigenschapResponse(
                        url = URI("https://example.com/zaken/1234/zaakeigenschappen/5678"),
                        zaak = zaakUrl,
                        eigenschap = eigenschapUrl,
                        waarde = "test-value"
                    )
                )
            )

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        // when
        plugin.deleteZaakeigenschap(
            execution = executionMock,
            eigenschapUrl = eigenschapUrl
        )

        // then
        verify(zakenApiClient).deleteZaakeigenschap(any(), any(), any())
    }

    @Test
    fun `should relateer zaken`() {

        // given
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val authenticationMock = mock<ZakenApiAuthentication>()
        val executionMock = mock<DelegateExecution>()
        val zaakResponseMock: ZaakResponse = mock()

        val documentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/zaken/1234")

        val teRelaterenZaakUri = URI("https://example.com/zaken/5678")
        val aardRelatie = "vervolg"

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(zaakResponseMock.relevanteAndereZaken).thenReturn(listOf())
        whenever(zakenApiClient.getZaak(authenticationMock, zaakUrl)).thenReturn(zaakResponseMock)

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        // when
        plugin.relateerZaken(
            execution = executionMock,
            teRelaterenZaakUri = teRelaterenZaakUri,
            aardRelatie = aardRelatie
        )

        // then
        val captor = argumentCaptor<PatchZaakRequest>()
        verify(zakenApiClient).patchZaak(
            eq(authenticationMock),
            eq(plugin.url),
            eq(zaakUrl),
            captor.capture()
        )

        val relevanteAndereZaken = captor.firstValue.relevanteAndereZaken
        assertThat(relevanteAndereZaken).hasSize(1)
        assertThat(relevanteAndereZaken!![0].url).isEqualTo(teRelaterenZaakUri)
        assertThat(relevanteAndereZaken[0].aardRelatie).isEqualTo(aardRelatie)
    }

    @Test
    fun `should link object to zaak`() {
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val authenticationMock = mock<ZakenApiAuthentication>()

        val documentId = UUID.randomUUID()
        whenever(zaakUrlProvider.getZaakUrl(any())).thenReturn(URI("https://zaak.url"))

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        plugin.createZaakObject(
            URI.create("https://zaak.url"),
            URI.create("https://object.url"),
            "zaakdetails",
            documentId
        )

        val captor = argumentCaptor<ZaakObjectRequest>()
        verify(zakenApiClient).createZaakObject(any(), any(), captor.capture())

        val request = captor.firstValue
        assertEquals("https://zaak.url", request.zaakUrl.toString())
        assertEquals(
            "https://object.url", request.objectUrl.toString()
        )
    }

    @Test
    fun `should retreive zaakbesluiten`() {
        val zakenApiClient: ZakenApiClient = mock()
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val authenticationMock = mock<ZakenApiAuthentication>()
        val execution = mock<DelegateExecution>()
        val documentId = UUID.randomUUID()
        val resultProcessVariable = "zaakbesluiten"

        whenever(execution.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUri())

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zakenApiClient = zakenApiClient,
            authenticationMock = authenticationMock
        )

        val zaakbesluiten = listOf(
            ZaakbesluitResponse(
                url = zaakbesluitUri1(),
                uuid = zaakbesluitUuid1(),
                besluit = besluitUri1()
            ),
            ZaakbesluitResponse(
                url = zaakbesluitUri2(),
                uuid = zaakbesluitUuid2(),
                besluit = besluitUri2()
            )
        )

        whenever(
            zakenApiClient.getZaakbesluiten(authenticationMock, zakenApiUri(), zaakUri())
        ).thenReturn(zaakbesluiten)

        val result = plugin.getZaakbesluiten(execution, resultProcessVariable)

        assertEquals(2, result.size)
        val first = result[0]
        assertEquals(zaakbesluitUri1(), first.url)
        assertEquals(zaakbesluitUuid1(), first.uuid)
        assertEquals(besluitUri1(), first.besluit)

        val second = result[1]
        assertEquals(zaakbesluitUri2(), second.url)
        assertEquals(zaakbesluitUuid2(), second.uuid)
        assertEquals(besluitUri2(), second.besluit)

        val expectedBesluitenList = zaakbesluiten.map { it.besluit }
        verify(execution).setVariable(resultProcessVariable, expectedBesluitenList)

        verify(zakenApiClient).getZaakbesluiten(authenticationMock, zakenApiUri(), zaakUri())
    }

    @Test
    fun `should get zaak informatieobjecten`() {
        // given
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val zaakDocumentService: ZaakDocumentService = mock()
        val executionMock = mock<DelegateExecution>()
        val objectMapper = MapperSingleton.get()
        val resultProcessVariable = "resultVariable"

        val documentId = UUID.randomUUID()
        val zaakUrl = zaakUri()

        val relatedFiles = listOf(
            RelatedFileDto(
                fileId = UUID.randomUUID(),
                fileName = "test-file1.pdf",
                sizeInBytes = 1024L,
                createdOn = LocalDate.now().atStartOfDay(),
                createdBy = "Test User 1",
                pluginConfigurationId = UUID.randomUUID(),
                title = "Test Document 1",
                description = "Test Description 1"
            ),
            RelatedFileDto(
                fileId = UUID.randomUUID(),
                fileName = "test-file2.pdf",
                sizeInBytes = 2048L,
                createdOn = LocalDate.now().atStartOfDay(),
                createdBy = "Test User 2",
                pluginConfigurationId = UUID.randomUUID(),
                title = "Test Document 2",
                description = "Test Description 2"
            )
        )

        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(documentId)).thenReturn(zaakUrl)
        whenever(zaakDocumentService.getInformatieObjectenAsRelatedFiles(documentId)).thenReturn(relatedFiles)

        val plugin = zakenApiPlugin(
            zaakUrlProvider = zaakUrlProvider,
            zaakDocumentService = zaakDocumentService,
            objectMapper = objectMapper
        )

        // when
        plugin.getZaakInformatieobjecten(executionMock, resultProcessVariable)

        // then
        verify(zaakUrlProvider).getZaakUrl(documentId)
        verify(zaakDocumentService).getInformatieObjectenAsRelatedFiles(documentId)

        val captor = argumentCaptor<Any>()
        verify(executionMock).setVariable(eq(resultProcessVariable), captor.capture())

        val expected: List<Map<String, Any?>> =
            objectMapper.convertValue(relatedFiles, object : TypeReference<List<Map<String, Any?>>>() {})
        assertEquals(expected, captor.firstValue)
    }

    private fun zakenApiPlugin(
        url: URI = zakenApiUri(),
        zaakUrlProvider: ZaakUrlProvider = mock(),
        zakenApiClient: ZakenApiClient = mock(),
        storageService: TemporaryResourceStorageService = mock(),
        zaakInstanceLinkRepository: ZaakInstanceLinkRepository = mock(),
        pluginService: PluginService = mock(),
        zaakHersteltermijnRepository: ZaakHersteltermijnRepository = mock(),
        zaakDocumentService: ZaakDocumentService = mock(),
        platformTransactionManager: PlatformTransactionManager = mock(),
        authenticationMock: ZakenApiAuthentication = mock(),
        valueResolverService: ValueResolverService = mock(),
        objectMapper: ObjectMapper = mock()
    ): ZakenApiPlugin {
        return ZakenApiPlugin(
            zakenApiClient,
            zaakUrlProvider,
            storageService,
            zaakInstanceLinkRepository,
            zaakDocumentService,
            pluginService,
            zaakHersteltermijnRepository,
            platformTransactionManager,
            valueResolverService,
            objectMapper
        ).apply {
            this.url = url
            this.authenticationPluginConfiguration = authenticationMock
        }
    }

    private fun zakenApiPluginAndMocksForZaakRol(
        zakenApiClient: ZakenApiClient,
        executionMock: DelegateExecution
    ): ZakenApiPlugin {
        val zaakUrlProvider: ZaakUrlProvider = mock()
        val documentId = UUID.randomUUID()
        whenever(executionMock.businessKey).thenReturn(documentId.toString())
        whenever(zaakUrlProvider.getZaakUrl(any())).thenReturn(zaakUri())
        return zakenApiPlugin(
            zakenApiClient = zakenApiClient,
            zaakUrlProvider = zaakUrlProvider
        )
    }

    private fun pluginServiceMock(): PluginService = mock {
        on { this.getObjectMapper()  } doReturn MapperSingleton.get()
    }

    private fun zakenApiUrl() = "https://zaken.plugin.url"
    private fun zakenApiUri() = URI(zakenApiUrl())

    private fun zaakUrl(id: String = "e1e96e94-e7ff-47d1-9ea1-7c7c81713480") = "${zakenApiUrl()}/zaken/$id"
    private fun zaakUri(id: String = "e1e96e94-e7ff-47d1-9ea1-7c7c81713480") = URI(zaakUrl(id))

    private fun roltypeUrl(id: String = "a860b0ab-47ca-4471-bff6-6fb53c760f07") = "${zakenApiUrl()}/roltypen/$id"
    private fun roltypeUri(id: String = "a860b0ab-47ca-4471-bff6-6fb53c760f07") = URI(roltypeUrl(id))

    private fun zaakbesluitId1() = "cccb4dd3-f4da-4812-b3a3-c05cd35722b0"
    private fun zaakbesluitUuid1() =
        UUID.fromString("cccb4dd3-f4da-4812-b3a3-c05cd35722b0")

    private fun zaakbesluitId2() = "38f55c4a-370d-4530-9909-b486500d7d17"
    private fun zaakbesluitUuid2() =
        UUID.fromString("38f55c4a-370d-4530-9909-b486500d7d17")

    private fun zaakbesluitUrl1(
        zaakId: String = "15e83392-a68f-4c1a-8b93-932b54b2d83e"
    ) = "${zakenApiUrl()}/zaken/$zaakId/besluiten/${zaakbesluitId1()}"

    private fun zaakbesluitUrl2(
        zaakId: String = "15e83392-a68f-4c1a-8b93-932b54b2d83e"
    ) = "${zakenApiUrl()}/zaken/$zaakId/besluiten/${zaakbesluitId2()}"

    private fun zaakbesluitUri1() = URI(zaakbesluitUrl1())
    private fun zaakbesluitUri2() = URI(zaakbesluitUrl2())

    private fun besluitUrl1(
        besluitId: String = zaakbesluitId1()
    ) = "${zakenApiUrl()}/besluiten/$besluitId"

    private fun besluitUrl2(
        besluitId: String = zaakbesluitId2()
    ) = "${zakenApiUrl()}/besluiten/$besluitId"

    private fun besluitUri1() = URI(besluitUrl1())
    private fun besluitUri2() = URI(besluitUrl2())
    private fun communicationChannel() = "https://example.com/comminicatiekanaal/example"
}