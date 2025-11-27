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

package com.ritense.besluitenapi

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.besluitenapi.client.Besluit
import com.ritense.besluitenapi.client.BesluitInformatieObject
import com.ritense.besluitenapi.client.BesluitNotFoundException
import com.ritense.besluitenapi.client.BesluitenApiClient
import com.ritense.besluitenapi.client.CreateBesluitInformatieObject
import com.ritense.besluitenapi.client.CreateBesluitRequest
import com.ritense.besluitenapi.client.PatchBesluitRequest
import com.ritense.besluitenapi.client.Vervalreden
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zgw.Rsin
import org.junit.Assert.assertThrows
import org.operaton.bpm.engine.delegate.DelegateExecution
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.net.URI
import java.time.LocalDate
import java.util.UUID

class BesluitenApiPluginTest {

    lateinit var besluitenApiPlugin: BesluitenApiPlugin
    lateinit var besluitenApiClient: BesluitenApiClient
    lateinit var zaakUrlProvider: ZaakUrlProvider
    lateinit var objectMapper: ObjectMapper

    @BeforeEach
    fun init() {
        zaakUrlProvider = mock()
        besluitenApiClient = mock()
        objectMapper = mock()
        besluitenApiPlugin = BesluitenApiPlugin(besluitenApiClient, zaakUrlProvider, objectMapper)
        besluitenApiPlugin.authenticationPluginConfiguration = mock()
        besluitenApiPlugin.url = URI.create("https://some-host.nl/besluiten/api/v1/besluitinformatieobjecten")
        besluitenApiPlugin.rsin = Rsin("252170362")
    }

    @Test
    fun `should call client when given minimal arguments`() {
        val authenticationMock = mock<BesluitenApiAuthentication>()
        val executionMock = mock<DelegateExecution>()

        val plugin = BesluitenApiPlugin(besluitenApiClient, zaakUrlProvider, objectMapper)
        plugin.url = URI("http://besluiten.api")
        plugin.rsin = Rsin("633182801")
        plugin.authenticationPluginConfiguration = authenticationMock

        val documentId = "c5e1c33f-dbe1-4f76-b93f-2fa6e20e2190"
        val zaakUrl = URI("http://zaak.api/zaak")
        whenever(executionMock.businessKey).thenReturn(documentId)
        whenever(zaakUrlProvider.getZaakUrl(UUID.fromString(documentId))).thenReturn(zaakUrl)

        val authenticationCaptor = argumentCaptor<BesluitenApiAuthentication>()
        val uriCaptor = argumentCaptor<URI>()
        val requestCaptor = argumentCaptor<CreateBesluitRequest>()
        val besluit = mock<Besluit>()
        whenever(
            besluitenApiClient.createBesluit(
                authenticationCaptor.capture(),
                uriCaptor.capture(),
                requestCaptor.capture()
            )
        ).thenReturn(besluit)

        plugin.createBesluit(
            executionMock,
            "http://catalogus.api/besluit",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        )

        // if createdBesluitUrl is null variable should not be set.
        verify(executionMock, never()).setVariable(any(), any())

        // verify creation request
        assertEquals(URI("http://besluiten.api"), uriCaptor.firstValue)
        assertEquals(authenticationMock, authenticationCaptor.firstValue)

        val createBesluitRequest = requestCaptor.firstValue

        assertEquals(URI("http://zaak.api/zaak"), createBesluitRequest.zaak)
        assertEquals(URI("http://catalogus.api/besluit"), createBesluitRequest.besluittype)
        assertEquals("633182801", createBesluitRequest.verantwoordelijkeOrganisatie)
        assertEquals(LocalDate.now(), createBesluitRequest.datum)
        assertEquals(LocalDate.now(), createBesluitRequest.ingangsdatum)
        assertNull(createBesluitRequest.toelichting)
        assertNull(createBesluitRequest.bestuursorgaan)
        assertNull(createBesluitRequest.vervaldatum)
        assertNull(createBesluitRequest.vervalreden)
        assertNull(createBesluitRequest.publicatiedatum)
        assertNull(createBesluitRequest.verzenddatum)
        assertNull(createBesluitRequest.uiterlijkeReactiedatum)
    }

    @Test
    fun `should call client when given all arguments`() {
        val authenticationMock = mock<BesluitenApiAuthentication>()
        val executionMock = mock<DelegateExecution>()

        val plugin = BesluitenApiPlugin(besluitenApiClient, zaakUrlProvider, objectMapper)
        plugin.url = URI("http://besluiten.api")
        plugin.rsin = Rsin("633182801")
        plugin.authenticationPluginConfiguration = authenticationMock

        val documentId = "c5e1c33f-dbe1-4f76-b93f-2fa6e20e2190"
        val zaakUrl = URI("http://zaak.api/zaak")
        val besluitUrl = URI("http://besluiten.api/besluit")
        whenever(executionMock.businessKey).thenReturn(documentId)
        whenever(zaakUrlProvider.getZaakUrl(UUID.fromString(documentId))).thenReturn(zaakUrl)

        val authenticationCaptor = argumentCaptor<BesluitenApiAuthentication>()
        val uriCaptor = argumentCaptor<URI>()
        val requestCaptor = argumentCaptor<CreateBesluitRequest>()
        val besluit = mock<Besluit>()
        whenever(besluit.url).thenReturn(besluitUrl)
        whenever(
            besluitenApiClient.createBesluit(
                authenticationCaptor.capture(),
                uriCaptor.capture(),
                requestCaptor.capture()
            )
        ).thenReturn(besluit)

        plugin.createBesluit(
            executionMock,
            "http://catalogus.api/besluit",
            "toelichting",
            "680572442",
            LocalDate.of(2020, 2, 20),
            LocalDate.of(2020, 2, 21),
            Vervalreden.TIJDELIJK,
            LocalDate.of(2020, 2, 22),
            LocalDate.of(2020, 2, 23),
            LocalDate.of(2020, 2, 24),
            "processVariableName"
        )

        // if createdBesluitUrl is not null variable should be set.
        verify(executionMock).setVariable("processVariableName", besluitUrl)

        // verify creation request
        assertEquals(URI("http://besluiten.api"), uriCaptor.firstValue)
        assertEquals(authenticationMock, authenticationCaptor.firstValue)

        val createBesluitRequest = requestCaptor.firstValue

        assertEquals(URI("http://zaak.api/zaak"), createBesluitRequest.zaak)
        assertEquals(URI("http://catalogus.api/besluit"), createBesluitRequest.besluittype)
        assertEquals("633182801", createBesluitRequest.verantwoordelijkeOrganisatie)
        assertEquals(LocalDate.now(), createBesluitRequest.datum)
        assertEquals(LocalDate.of(2020, 2, 20), createBesluitRequest.ingangsdatum)
        assertEquals("toelichting", createBesluitRequest.toelichting)
        assertEquals("680572442", createBesluitRequest.bestuursorgaan)
        assertEquals(LocalDate.of(2020, 2, 21), createBesluitRequest.vervaldatum)
        assertEquals(Vervalreden.TIJDELIJK, createBesluitRequest.vervalreden)
        assertEquals(LocalDate.of(2020, 2, 22), createBesluitRequest.publicatiedatum)
        assertEquals(LocalDate.of(2020, 2, 23), createBesluitRequest.verzenddatum)
        assertEquals(LocalDate.of(2020, 2, 24), createBesluitRequest.uiterlijkeReactiedatum)
    }

    @Test
    fun `should link document to besluit`() {
        val besluitenApiAuthenticationCaptor = argumentCaptor<BesluitenApiAuthentication>()
        val uriCaptor = argumentCaptor<URI>()
        val besluitInformatieObjectCaptor = argumentCaptor<CreateBesluitInformatieObject>()
        val documentUrl = "https://some-host.nl/documenten/api/v1/${UUID.randomUUID()}"
        val besluitUrl = "https://some-host.nl/besluit/api/v1/besluitobjecten/${UUID.randomUUID()}"
        val besluitInformatieObjectUrl =
            "https://some-host.nl/besluiten/api/v1/besluiteninformatieobjecten/${UUID.randomUUID()}"
        whenever(besluitenApiClient.createBesluitInformatieObject(any(), any(), any())).thenReturn(
            BesluitInformatieObject(besluitInformatieObjectUrl, documentUrl, besluitUrl)
        )
        besluitenApiPlugin.linkDocumentToBesluit(
            documentUrl,
            besluitUrl
        )

        verify(besluitenApiClient).createBesluitInformatieObject(
            besluitenApiAuthenticationCaptor.capture(),
            uriCaptor.capture(),
            besluitInformatieObjectCaptor.capture()
        )
        val besluitInformatieObjectValue = besluitInformatieObjectCaptor.firstValue
        val besluitenApiAuthenticationValue = besluitenApiAuthenticationCaptor.firstValue
        val uriValue = uriCaptor.firstValue

        assertEquals(besluitInformatieObjectValue.besluit, besluitUrl)
        assertEquals(besluitInformatieObjectValue.informatieobject, documentUrl)
        assertEquals(besluitenApiAuthenticationValue, besluitenApiPlugin.authenticationPluginConfiguration)
        assertEquals(uriValue, besluitenApiPlugin.url)
    }

    @Test
    fun `should patch zaakbesluit`() {
        val authenticationMock = mock<BesluitenApiAuthentication>()
        val besluitenApiClient = mock<BesluitenApiClient>()
        val zaakUrlProvider = mock<ZaakUrlProvider>() // only needed for constructor if required

        val plugin = BesluitenApiPlugin(besluitenApiClient, zaakUrlProvider, objectMapper)
        plugin.authenticationPluginConfiguration = authenticationMock

        val besluitUrl = URI("http://besluiten.api/besluit")

        val beslisdatum = LocalDate.of(2025, 11, 1)
        val toelichting = "toelichting"
        val bestuursorgaan = "680572442"
        val ingangsdatum = LocalDate.of(2025, 11, 2)
        val vervaldatum = LocalDate.of(2025, 11, 3)
        val vervalreden = Vervalreden.INGETROKKEN_OVERHEID
        val publicatiedatum = LocalDate.of(2025, 11, 4)
        val verzenddatum = LocalDate.of(2025, 11, 5)
        val uiterlijkeReactieDatum = LocalDate.of(2025, 11, 6)

        val authenticationCaptor = argumentCaptor<BesluitenApiAuthentication>()
        val uriCaptor = argumentCaptor<URI>()
        val requestCaptor = argumentCaptor<PatchBesluitRequest>()
        val besluit = mock<Besluit>()

        whenever(
            besluitenApiClient.patchBesluit(
                authenticationCaptor.capture(),
                uriCaptor.capture(),
                requestCaptor.capture()
            )
        ).thenReturn(besluit)

        val result = plugin.patchBesluit(
            besluitUrl = besluitUrl,
            beslisdatum = beslisdatum,
            toelichting = toelichting,
            bestuursorgaan = bestuursorgaan,
            ingangsdatum = ingangsdatum,
            vervaldatum = vervaldatum,
            vervalreden = vervalreden,
            publicatiedatum = publicatiedatum,
            verzenddatum = verzenddatum,
            uiterlijkeReactieDatum = uiterlijkeReactieDatum
        )

        assertEquals(besluit, result)

        assertEquals(authenticationMock, authenticationCaptor.firstValue)
        assertEquals(besluitUrl, uriCaptor.firstValue)

        val patchBesluitRequest = requestCaptor.firstValue

        assertEquals(beslisdatum, patchBesluitRequest.datum)
        assertEquals(toelichting, patchBesluitRequest.toelichting)
        assertEquals(bestuursorgaan, patchBesluitRequest.bestuursorgaan)
        assertEquals(ingangsdatum, patchBesluitRequest.ingangsdatum)
        assertEquals(vervaldatum, patchBesluitRequest.vervaldatum)
        assertEquals(vervalreden, patchBesluitRequest.vervalreden)
        assertEquals(publicatiedatum, patchBesluitRequest.publicatiedatum)
        assertEquals(verzenddatum, patchBesluitRequest.verzenddatum)
        assertEquals(uiterlijkeReactieDatum, patchBesluitRequest.uiterlijkeReactiedatum)
    }

    @Test
    fun `should retrieve a besluit`() {
        val authenticationMock = mock<BesluitenApiAuthentication>()
        val executionMock = mock<DelegateExecution>()
        val baseUrl = URI("https://test-host.nl/api/v1/besluiten")

        val plugin = BesluitenApiPlugin(besluitenApiClient, zaakUrlProvider, objectMapper).apply {
            url = baseUrl
            authenticationPluginConfiguration = authenticationMock
        }

        val documentId = UUID.randomUUID()
        val besluitUrl = "https://test-host.nl/api/v1/besluiten/3f8a2c7e-9b41-4d6f-a2f0-7e6c1b9b6d3a"
        val besluitUuid = "3f8a2c7e-9b41-4d6f-a2f0-7e6c1b9b6d3a"
        val resultProcessVariable = "besluit"

        whenever(executionMock.businessKey).thenReturn(documentId.toString())

        val besluit = Besluit(
            url = URI("http://catalogus.api/besluit"),
            identificatie = null,
            verantwoordelijkeOrganisatie = "680572442",
            besluittype = URI("http://catalogus.api/besluittype"),
            zaak = null,
            datum = LocalDate.of(2025, 11, 20),
            toelichting = "Toelichting",
            bestuursorgaan = null,
            ingangsdatum = LocalDate.of(2025, 11, 21),
            vervaldatum = LocalDate.of(2025, 11, 22),
            vervalreden = Vervalreden.TIJDELIJK,
            vervalredenWeergave = null,
            publicatiedatum = LocalDate.of(2025, 11, 23),
            verzenddatum = null,
            uiterlijkeReactiedatum = LocalDate.of(2025, 11, 24)
        )

        whenever(
            besluitenApiClient.getBesluit(
                authenticationMock,
                baseUrl,
                besluitUuid
            )
        ).thenReturn(besluit)

        val besluitJson = mock<JsonNode>()
        whenever(objectMapper.valueToTree<JsonNode>(besluit)).thenReturn(besluitJson)

        val result = plugin.getBesluit(executionMock, besluitUrl, resultProcessVariable)

        assertEquals(besluit, result)

        assertEquals(URI("http://catalogus.api/besluit"), result.url)
        assertEquals("680572442", result.verantwoordelijkeOrganisatie)
        assertEquals(URI("http://catalogus.api/besluittype"), result.besluittype)
        assertEquals(LocalDate.of(2025, 11, 20), result.datum)
        assertEquals("Toelichting", result.toelichting)
        assertEquals(LocalDate.of(2025, 11, 21), result.ingangsdatum)
        assertEquals(LocalDate.of(2025, 11, 22), result.vervaldatum)
        assertEquals(Vervalreden.TIJDELIJK, result.vervalreden)
        assertEquals(LocalDate.of(2025, 11, 23), result.publicatiedatum)
        assertEquals(LocalDate.of(2025, 11, 24), result.uiterlijkeReactiedatum)

        assertNull(result.identificatie)
        assertNull(result.bestuursorgaan)
        assertNull(result.vervalredenWeergave)
        assertNull(result.verzenddatum)

        verify(besluitenApiClient, times(1)).getBesluit(
            authenticationMock,
            baseUrl,
            besluitUuid
        )
        verify(executionMock, times(1)).setVariable(resultProcessVariable, besluitJson)
    }

    @Test
    fun `should throw BesluitNotFoundException when besluit not found`() {
        val authenticationMock = mock<BesluitenApiAuthentication>()
        val executionMock = mock<DelegateExecution>()
        val baseUrl = URI("https://test-host.nl/api/v1/besluiten")

        val plugin = BesluitenApiPlugin(besluitenApiClient, zaakUrlProvider, objectMapper).apply {
            url = baseUrl
            authenticationPluginConfiguration = authenticationMock
        }

        val documentId = UUID.randomUUID()
        val besluitUuid = "3f8a2c7e-9b41-4d6f-a2f0-7e6c1b9b6d3a"
        val besluitUrl = "$baseUrl/$besluitUuid"
        val resultProcessVariable = "besluit"

        whenever(executionMock.businessKey).thenReturn(documentId.toString())

        whenever(
            besluitenApiClient.getBesluit(
                authenticationMock,
                baseUrl,
                besluitUuid
            )
        ).thenThrow(RuntimeException("NOT_FOUND"))

        val ex = assertThrows(BesluitNotFoundException::class.java) {
            plugin.getBesluit(executionMock, besluitUrl, resultProcessVariable)
        }

        assertEquals("No besluit found for url '$besluitUrl'", ex.message)

        verify(besluitenApiClient).getBesluit(authenticationMock, baseUrl, besluitUuid)

        verify(executionMock, never()).setVariable(any(), any())
    }
}