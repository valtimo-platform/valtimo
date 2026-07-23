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

package com.ritense.zakenapi.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.DocumentService
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.Betalingsindicatie
import com.ritense.zakenapi.domain.ZaakInformatieObject
import com.ritense.zakenapi.domain.ZaakInstanceLink
import com.ritense.zakenapi.domain.ZaakInstanceLinkId
import com.ritense.zakenapi.domain.ZaakObject
import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zakenapi.domain.ZaakResultaat
import com.ritense.zakenapi.domain.ZaakStatus
import com.ritense.zakenapi.domain.ZaakbesluitResponse
import com.ritense.zakenapi.domain.ZaakeigenschapResponse
import com.ritense.zakenapi.domain.rol.BetrokkeneType
import com.ritense.zakenapi.domain.rol.Rol
import com.ritense.zakenapi.link.ZaakInstanceLinkNotFoundException
import com.ritense.zakenapi.link.ZaakInstanceLinkService
import com.ritense.zgw.Rsin
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.net.URI
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CaseZgwInspectionResourceTest {

    private lateinit var documentService: DocumentService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var zaakInstanceLinkService: ZaakInstanceLinkService
    private lateinit var pluginService: PluginService

    private val objectMapper: ObjectMapper = ObjectMapper().findAndRegisterModules()

    private lateinit var resource: CaseZgwInspectionResource

    private val caseId: UUID = UUID.randomUUID()
    private val zaakUrl: URI = URI("https://openzaak.example.nl/zaken/api/v1/zaken/${UUID.randomUUID()}")
    private val zaakTypeUrl: URI = URI("https://openzaak.example.nl/catalogi/api/v1/zaaktypen/${UUID.randomUUID()}")

    @BeforeEach
    fun setUp() {
        documentService = mock()
        authorizationService = mock()
        zaakInstanceLinkService = mock()
        pluginService = mock()

        resource = CaseZgwInspectionResource(
            documentService = documentService,
            authorizationService = authorizationService,
            zaakInstanceLinkService = zaakInstanceLinkService,
            pluginService = pluginService,
            objectMapper = objectMapper,
        )

        whenever(documentService.findBy(any<Document.Id>()))
            .thenReturn(Optional.of(mock<JsonSchemaDocument>()))
    }

    @Test
    fun `should require INSPECT permission on the document`() {
        whenever(zaakInstanceLinkService.getByDocumentId(caseId))
            .thenThrow(ZaakInstanceLinkNotFoundException("no link"))

        resource.getZgwInspection(caseId)

        val captor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertEquals(JsonSchemaDocument::class.java, captor.firstValue.resourceType)
    }

    @Test
    fun `should propagate authorization failure without calling downstream services`() {
        doThrow(RuntimeException("denied")).whenever(authorizationService)
            .requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())

        assertThrows<RuntimeException> { resource.getZgwInspection(caseId) }

        verify(zaakInstanceLinkService, never()).getByDocumentId(any())
        verify(pluginService, never()).createInstance<ZakenApiPlugin>(any(), any())
    }

    @Test
    fun `should return empty DTO when no ZaakInstanceLink exists`() {
        whenever(zaakInstanceLinkService.getByDocumentId(caseId))
            .thenThrow(ZaakInstanceLinkNotFoundException("no link"))

        val response = resource.getZgwInspection(caseId)
        val body = response.body!!

        assertEquals(200, response.statusCode.value())
        assertNull(body.zaakInstanceLink)
        assertNull(body.zaak)
        assertTrue(body.eigenschappen.isEmpty())
        assertTrue(body.rollen.isEmpty())
        assertTrue(body.statusHistory.isEmpty())
        assertNull(body.resultaat)
        assertTrue(body.zaakObjecten.isEmpty())
        assertTrue(body.zaakInformatieObjecten.isEmpty())
        assertTrue(body.besluiten.isEmpty())
        assertTrue(body.warnings.isEmpty())
    }

    @Test
    fun `should return warning when no ZakenApiPlugin matches the zaak URL host`() {
        whenever(zaakInstanceLinkService.getByDocumentId(caseId)).thenReturn(zaakInstanceLink())
        whenever(pluginService.createInstance(eqClass(), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(null)

        val body = resource.getZgwInspection(caseId).body!!

        assertNotNull(body.zaakInstanceLink)
        assertNull(body.zaak)
        assertEquals(1, body.warnings.size)
        assertTrue(body.warnings.single().startsWith("zaak: no Zaken API plugin"))
    }

    @Test
    fun `should aggregate every section on the happy path`() {
        whenever(zaakInstanceLinkService.getByDocumentId(caseId)).thenReturn(zaakInstanceLink())
        val plugin = mock<ZakenApiPlugin>()
        whenever(pluginService.createInstance(eqClass(), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(plugin)

        whenever(plugin.getZaak(zaakUrl)).thenReturn(zaakResponse())
        whenever(plugin.getZaakeigenschappen(zaakUrl)).thenReturn(listOf(zaakeigenschap()))
        whenever(plugin.getZaakRollen(zaakUrl)).thenReturn(listOf(rol()))
        whenever(plugin.getZaakStatussen(zaakUrl)).thenReturn(listOf(zaakStatus()))
        whenever(plugin.getZaakResultaat(zaakUrl)).thenReturn(zaakResultaat())
        whenever(plugin.getZaakObjecten(zaakUrl)).thenReturn(listOf(zaakObject()))
        whenever(plugin.getZaakInformatieObjecten(caseId, zaakUrl)).thenReturn(listOf(zaakInformatieObject()))
        whenever(plugin.getZaakbesluiten(zaakUrl)).thenReturn(listOf(zaakbesluit()))

        val body = resource.getZgwInspection(caseId).body!!

        assertNotNull(body.zaakInstanceLink)
        assertNotNull(body.zaak)
        assertEquals(1, body.eigenschappen.size)
        assertEquals(1, body.rollen.size)
        assertEquals(1, body.statusHistory.size)
        assertNotNull(body.resultaat)
        assertEquals(1, body.zaakObjecten.size)
        assertEquals(1, body.zaakInformatieObjecten.size)
        assertEquals(1, body.besluiten.size)
        assertTrue(body.warnings.isEmpty())
    }

    @Test
    fun `should short-circuit and skip other sections when getZaak fails`() {
        whenever(zaakInstanceLinkService.getByDocumentId(caseId)).thenReturn(zaakInstanceLink())
        val plugin = mock<ZakenApiPlugin>()
        whenever(pluginService.createInstance(eqClass(), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(plugin)

        whenever(plugin.getZaak(zaakUrl)).thenThrow(RuntimeException("404 Not Found"))

        val body = resource.getZgwInspection(caseId).body!!

        assertNotNull(body.zaakInstanceLink)
        assertNull(body.zaak)
        assertTrue(body.eigenschappen.isEmpty())
        assertTrue(body.rollen.isEmpty())
        assertTrue(body.statusHistory.isEmpty())
        assertNull(body.resultaat)
        assertTrue(body.zaakObjecten.isEmpty())
        assertTrue(body.zaakInformatieObjecten.isEmpty())
        assertTrue(body.besluiten.isEmpty())
        assertEquals(1, body.warnings.size)
        assertTrue(body.warnings.single().startsWith("zaak:"))

        // The other plugin methods must not have been called.
        verify(plugin, never()).getZaakeigenschappen(any())
        verify(plugin, never()).getZaakRollen(any(), anyOrNull())
        verify(plugin, never()).getZaakStatussen(any())
        verify(plugin, never()).getZaakResultaat(any())
        verify(plugin, never()).getZaakObjecten(any())
        verify(plugin, never()).getZaakInformatieObjecten(any(), any())
        verify(plugin, never()).getZaakbesluiten(any())
    }

    @Test
    fun `should record a warning when a single section fails and keep the rest`() {
        whenever(zaakInstanceLinkService.getByDocumentId(caseId)).thenReturn(zaakInstanceLink())
        val plugin = mock<ZakenApiPlugin>()
        whenever(pluginService.createInstance(eqClass(), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(plugin)

        whenever(plugin.getZaak(zaakUrl)).thenReturn(zaakResponse())
        whenever(plugin.getZaakeigenschappen(zaakUrl))
            .thenThrow(RuntimeException("eigenschappen endpoint blew up"))
        whenever(plugin.getZaakRollen(zaakUrl)).thenReturn(emptyList())
        whenever(plugin.getZaakStatussen(zaakUrl)).thenReturn(emptyList())
        whenever(plugin.getZaakResultaat(zaakUrl)).thenReturn(null)
        whenever(plugin.getZaakObjecten(zaakUrl)).thenReturn(emptyList())
        whenever(plugin.getZaakInformatieObjecten(caseId, zaakUrl)).thenReturn(emptyList())
        whenever(plugin.getZaakbesluiten(zaakUrl)).thenReturn(emptyList())

        val body = resource.getZgwInspection(caseId).body!!

        assertNotNull(body.zaak)
        assertTrue(body.eigenschappen.isEmpty())
        assertEquals(1, body.warnings.size)
        assertTrue(body.warnings.single().startsWith("eigenschappen:"))
    }

    @Test
    fun `should serialise the zaak as a JsonNode for the raw view`() {
        whenever(zaakInstanceLinkService.getByDocumentId(caseId)).thenReturn(zaakInstanceLink())
        val plugin = mock<ZakenApiPlugin>()
        whenever(pluginService.createInstance(eqClass(), any<(com.fasterxml.jackson.databind.JsonNode) -> Boolean>()))
            .thenReturn(plugin)
        whenever(plugin.getZaak(zaakUrl)).thenReturn(zaakResponse())
        whenever(plugin.getZaakeigenschappen(zaakUrl)).thenReturn(emptyList())
        whenever(plugin.getZaakRollen(zaakUrl)).thenReturn(emptyList())
        whenever(plugin.getZaakStatussen(zaakUrl)).thenReturn(emptyList())
        whenever(plugin.getZaakResultaat(zaakUrl)).thenReturn(null)
        whenever(plugin.getZaakObjecten(zaakUrl)).thenReturn(emptyList())
        whenever(plugin.getZaakInformatieObjecten(caseId, zaakUrl)).thenReturn(emptyList())
        whenever(plugin.getZaakbesluiten(zaakUrl)).thenReturn(emptyList())

        val zaak = resource.getZgwInspection(caseId).body!!.zaak!!

        assertEquals(zaakUrl.toString(), zaak.get("url").asText())
    }

    private fun zaakInstanceLink() = ZaakInstanceLink(
        zaakInstanceLinkId = ZaakInstanceLinkId.newId(UUID.randomUUID()),
        zaakInstanceUrl = zaakUrl,
        zaakInstanceId = UUID.randomUUID(),
        documentId = caseId,
        zaakTypeUrl = zaakTypeUrl,
    )

    private fun zaakResponse() = ZaakResponse(
        url = zaakUrl,
        uuid = UUID.randomUUID(),
        identificatie = "ZAAK-2026-001",
        bronorganisatie = Rsin("002564440"),
        zaaktype = zaakTypeUrl,
        verantwoordelijkeOrganisatie = Rsin("002564440"),
        startdatum = LocalDate.parse("2026-05-21"),
        betalingsindicatie = Betalingsindicatie.NVT,
    )

    private fun zaakeigenschap() = ZaakeigenschapResponse(
        url = URI("$zaakUrl/zaakeigenschappen/${UUID.randomUUID()}"),
        uuid = UUID.randomUUID(),
        zaak = zaakUrl,
        eigenschap = URI("https://openzaak.example.nl/catalogi/api/v1/eigenschappen/${UUID.randomUUID()}"),
        naam = "leeftijd",
        waarde = "42",
    )

    private fun rol() = Rol(
        url = URI("https://openzaak.example.nl/zaken/api/v1/rollen/${UUID.randomUUID()}"),
        uuid = UUID.randomUUID(),
        zaak = zaakUrl,
        betrokkeneType = BetrokkeneType.NATUURLIJK_PERSOON,
        roltype = URI("https://openzaak.example.nl/catalogi/api/v1/roltypen/${UUID.randomUUID()}"),
        roltoelichting = "test",
    )

    private fun zaakStatus() = ZaakStatus(
        url = URI("https://openzaak.example.nl/zaken/api/v1/statussen/${UUID.randomUUID()}"),
        uuid = UUID.randomUUID(),
        zaak = zaakUrl,
        statustype = URI("https://openzaak.example.nl/catalogi/api/v1/statustypen/${UUID.randomUUID()}"),
        datumStatusGezet = LocalDateTime.parse("2026-05-21T12:00:00"),
        statustoelichting = "intake",
    )

    private fun zaakResultaat() = ZaakResultaat(
        url = URI("https://openzaak.example.nl/zaken/api/v1/resultaten/${UUID.randomUUID()}"),
        uuid = UUID.randomUUID(),
        zaak = zaakUrl,
        resultaattype = URI("https://openzaak.example.nl/catalogi/api/v1/resultaattypen/${UUID.randomUUID()}"),
        toelichting = "afgewezen",
    )

    private fun zaakObject() = ZaakObject(
        url = URI("https://openzaak.example.nl/zaken/api/v1/zaakobjecten/${UUID.randomUUID()}"),
        uuid = UUID.randomUUID(),
        zaakUrl = zaakUrl,
        objectUrl = URI("https://objecten.example.nl/api/v2/objects/${UUID.randomUUID()}"),
        objectType = "overige",
        objectTypeOverige = "huisvesting",
        relatieomschrijving = null,
    )

    private fun zaakInformatieObject() = ZaakInformatieObject(
        url = URI("https://openzaak.example.nl/zaken/api/v1/zaakinformatieobjecten/${UUID.randomUUID()}"),
        uuid = UUID.randomUUID(),
        informatieobject = URI("https://openzaak.example.nl/documenten/api/v1/enkelvoudiginformatieobjecten/${UUID.randomUUID()}"),
        zaak = zaakUrl,
        aardRelatieWeergave = "Hoort bij, omgekeerd: kent",
        titel = "intake.pdf",
        registratiedatum = LocalDateTime.parse("2026-05-21T12:00:00"),
    )

    private fun zaakbesluit() = ZaakbesluitResponse(
        url = URI("https://openzaak.example.nl/zaken/api/v1/zaakbesluiten/${UUID.randomUUID()}"),
        uuid = UUID.randomUUID(),
        besluit = URI("https://openzaak.example.nl/besluiten/api/v1/besluiten/${UUID.randomUUID()}"),
    )

    private fun eqClass() = org.mockito.kotlin.eq(ZakenApiPlugin::class.java)
}
