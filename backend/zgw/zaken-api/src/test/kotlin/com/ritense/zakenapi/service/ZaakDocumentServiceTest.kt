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

package com.ritense.zakenapi.service

import com.ritense.authorization.AuthorizationService
import com.ritense.catalogiapi.service.CatalogiService
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapi.client.DocumentInformatieObject
import com.ritense.documentenapi.domain.DocumentenApiVersion
import com.ritense.documentenapi.service.DocumentenApiService
import com.ritense.documentenapi.service.DocumentenApiVersionService
import com.ritense.documentenapi.service.DocumentenApiVersionService.Companion.MINIMUM_VERSION
import com.ritense.documentenapi.web.rest.dto.DocumentSearchRequest
import com.ritense.documentenapi.web.rest.dto.DocumentenApiDocumentDto
import com.ritense.documentenapi.web.rest.dto.ModifyDocumentRequest
import com.ritense.plugin.domain.PluginConfiguration
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakInformatieObject
import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zgw.Rsin
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import java.net.URI
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.UUID

class ZaakDocumentServiceTest {

    lateinit var service: ZaakDocumentService
    lateinit var zaakUrlProvider: ZaakUrlProvider
    lateinit var pluginService: PluginService
    lateinit var catalogiService: CatalogiService
    lateinit var documentenApiService: DocumentenApiService
    lateinit var documentenApiVersionService: DocumentenApiVersionService
    lateinit var authorizationService: AuthorizationService
    lateinit var modifyDocumentRequest: ModifyDocumentRequest

    @BeforeEach
    fun init() {
        zaakUrlProvider = mock()
        pluginService = mock()
        catalogiService = mock()
        documentenApiService = mock()
        documentenApiVersionService = mock()
        authorizationService = mock()
        service = ZaakDocumentService(
            zaakUrlProvider,
            pluginService,
            catalogiService,
            documentenApiService,
            documentenApiVersionService,
            authorizationService,
            false
        )
    }

    @Test
    fun `should get informatieobjecten for document`() {
        val caseId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/$caseId")
        whenever(zaakUrlProvider.getZaakUrl(caseId)).thenReturn(zaakUrl)

        val zakenApiPlugin = mock<ZakenApiPlugin>()
        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any()))
            .doReturn(zakenApiPlugin)


        val zaakInformatieObjects = createZaakInformatieObjecten(zaakUrl)
        whenever(zakenApiPlugin.getZaakInformatieObjecten(caseId, zaakUrl)).thenReturn(
            zaakInformatieObjects
        )

        val documentenApiPluginConfiguration = mock<PluginConfiguration>()
        val documentenApiPlugin = mock<DocumentenApiPlugin>()
        whenever(pluginService.findPluginConfiguration(eq(DocumentenApiPlugin::class.java), any()))
            .doReturn(documentenApiPluginConfiguration)
        whenever(documentenApiPluginConfiguration.id)
            .doReturn(PluginConfigurationId(UUID.randomUUID()))
        whenever(pluginService.createInstance(eq(documentenApiPluginConfiguration)))
            .doReturn(documentenApiPlugin)
        whenever(documentenApiPlugin.getInformatieObject(any<URI>(), any())).doAnswer { answer ->
            val uri = answer.getArgument(0) as URI

            createDocumentInformatieObject(uri)
        }

        val relatedFiles = service.getInformatieObjectenAsRelatedFiles(caseId)

        assertEquals(5, relatedFiles.size)
        relatedFiles.forEachIndexed { index, relatedFile ->
            assertEquals(UUID.fromString("b059092c-9557-431a-9118-97f147903270"), relatedFile.fileId)
            assertEquals(documentenApiPluginConfiguration.id.id, relatedFile.pluginConfigurationId)
            assertEquals("http://localhost/informatieobjecttype", relatedFile.informatieobjecttype)
        }
    }

    @Test
    fun `should get zaak by document id`() {
        val caseDocumentId = UUID.randomUUID()
        val zaakId = UUID.randomUUID()
        val zaak = ZaakResponse(
            url = URI("http://localhost/$zaakId"),
            uuid = zaakId,
            bronorganisatie = Rsin("002564440"),
            zaaktype = URI("http://localhost/zaaktype"),
            verantwoordelijkeOrganisatie = Rsin("002564440"),
            startdatum = LocalDate.now()
        )
        doReturn(zaak.url).whenever(zaakUrlProvider).getZaakUrl(caseDocumentId)
        val zakenApiPlugin = mock<ZakenApiPlugin>()
        doReturn(zakenApiPlugin).whenever(pluginService).createInstance(eq(ZakenApiPlugin::class.java), any())
        doReturn(zaak).whenever(zakenApiPlugin).getZaak(zaak.url)

        val result = service.getZaakByCaseDocumentId(caseDocumentId)

        assertEquals(zaak, result)
    }

    @Test
    fun `should get InformatieObjecten Page for zaak`() {
        val caseDocumentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/$caseDocumentId")
        whenever(zaakUrlProvider.getZaakUrl(caseDocumentId)).thenReturn(zaakUrl)

        val documentSearchRequestCaptor = argumentCaptor<DocumentSearchRequest>()
        val pageable = mock<Pageable>()
        val documentSearchRequest = DocumentSearchRequest()
        val documentInformatieObject = createDocumentInformatieObject(URI("http://localhost/doc/${UUID.randomUUID()}"))
        val resultPage = PageImpl(listOf(documentInformatieObject))

        val pluginConfiguration = mock<PluginConfiguration>()
        whenever(pluginConfiguration.id).thenReturn(PluginConfigurationId(UUID.randomUUID()))
        whenever(pluginService.findPluginConfiguration(eq(DocumentenApiPlugin::class.java), any()))
            .thenReturn(pluginConfiguration)

        val version = DocumentenApiVersion("1.5.0-test-1.0.0", listOf("titel"), listOf("titel"), true)
        whenever(documentenApiVersionService.getVersionByDocumentId(caseDocumentId))
            .thenReturn(version)

        whenever(
            authorizationService.hasPermission<Any>(any())
        ).thenReturn(true)

        whenever(
            documentenApiService.getCaseInformatieObjecten(
                any(),
                documentSearchRequestCaptor.capture(),
                any()
            )
        ).thenReturn(resultPage)

        val page = service.getInformatieObjectenAsRelatedFilesPage(caseDocumentId, documentSearchRequest, pageable)

        val expectedPage = resultPage.map { it ->
            DocumentenApiDocumentDto(
                fileId = UUID.fromString(it.url.path.substringAfterLast("/")),
                pluginConfigurationId = pluginConfiguration.id.id,
                bestandsnaam = it.bestandsnaam,
                bestandsomvang = it.bestandsomvang,
                creatiedatum = it.creatiedatum.atStartOfDay(),
                auteur = it.auteur,
                titel = it.titel,
                status = it.status?.key,
                taal = it.taal,
                identificatie = it.identificatie,
                beschrijving = it.beschrijving,
                informatieobjecttype = it.informatieobjecttype,
                informatieobjecttypeOmschrijving = null,
                trefwoorden = it.trefwoorden,
                formaat = it.formaat,
                verzenddatum = it.verzenddatum,
                ontvangstdatum = it.ontvangstdatum,
                vertrouwelijkheidaanduiding = it.vertrouwelijkheidaanduiding?.key,
                versie = it.versie,
                indicatieGebruiksrecht = it.indicatieGebruiksrecht
            )
        }

        assertEquals(expectedPage.content.toString(), page.content.toString())
        assertEquals(expectedPage.totalElements, page.totalElements)
        assertEquals(expectedPage.number, page.number)
        assertEquals(expectedPage.size, page.size)
        // Check if the zaakUrl is set in the DocumentSearchRequest
        assertEquals(zaakUrl, documentSearchRequestCaptor.firstValue.zaakUrl)
    }

    @Test
    fun `should throw when get InformatieObjecten Page for zaak does not support filtering`() {
        val caseDocumentId = UUID.randomUUID()
        val zaakUrl = URI("https://example.com/1")
        whenever(zaakUrlProvider.getZaakUrl(caseDocumentId)).thenReturn(zaakUrl)

        val pageable = PageRequest.of(0, 10)
        val documentSearchRequest = DocumentSearchRequest(titel = "The Ritensions")

        whenever(documentenApiVersionService.getVersionByDocumentId(caseDocumentId)).thenReturn(MINIMUM_VERSION)
        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any()))
            .thenReturn(mock<ZakenApiPlugin>())

        val exception = assertThrows<IllegalStateException> {
            service.getInformatieObjectenAsRelatedFilesPage(caseDocumentId, documentSearchRequest, pageable)
        }

        assertEquals("Unsupported filter 'titel' on Documenten API with version 1.0.0", exception.message)
    }

    @Test
    fun `should delete all informatie objecten for zaak`() {
        val caseDocumentId = UUID.randomUUID()
        val documentUrl = URI("http://localhost/zaak/$caseDocumentId")
        val zaakApiPlugin = mock<ZakenApiPlugin>()

        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any()))
            .thenReturn(zaakApiPlugin)
        val doc1 = mock<ZaakInformatieObject>()
        val doc2 = mock<ZaakInformatieObject>()

        whenever(zaakApiPlugin.getZaakInformatieObjecten(caseDocumentId, documentUrl)).thenReturn(listOf(doc1, doc2))

        whenever(doc1.informatieobject).thenReturn(URI("http://localhost/doc/1"))
        whenever(doc2.informatieobject).thenReturn(URI("http://localhost/doc/2"))

        whenever(zaakApiPlugin.getZaakInformatieObjectenByInformatieobjectUrl(caseDocumentId, URI("http://localhost/doc/1")))
            .thenReturn(listOf(doc1))
        whenever(zaakApiPlugin.getZaakInformatieObjectenByInformatieobjectUrl(caseDocumentId, URI("http://localhost/doc/2")))
            .thenReturn(listOf(doc2))

        service.deleteRelatedInformatieObjecten(caseDocumentId, documentUrl)

        val zaakDocumentCaptor = argumentCaptor<URI>()
        verify(documentenApiService, times(2)).deleteInformatieObject(zaakDocumentCaptor.capture(), any())

        assertEquals(URI("http://localhost/doc/1"), zaakDocumentCaptor.firstValue)
        assertEquals(URI("http://localhost/doc/2"), zaakDocumentCaptor.secondValue)
    }

    @Test
    fun `should only delete the link between informatie object and zaak when the informatie object is linked to multiple zaken`() {
        val caseDocumentId = UUID.randomUUID()
        val documentUrl = URI("http://localhost/zaak/$caseDocumentId")
        val zaakApiPlugin = mock<ZakenApiPlugin>()

        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any()))
            .thenReturn(zaakApiPlugin)
        val doc1 = mock<ZaakInformatieObject>()
        val otherZaakDoc = mock<ZaakInformatieObject>()

        whenever(zaakApiPlugin.getZaakInformatieObjecten(caseDocumentId, documentUrl)).thenReturn(listOf(doc1))

        val doc1Url = URI("http://localhost/doc/1")
        val relationUrl = URI("http://localhost/zaak-informatieobject/1")
        whenever(doc1.informatieobject).thenReturn(doc1Url)
        whenever(doc1.url).thenReturn(relationUrl)

        whenever(zaakApiPlugin.getZaakInformatieObjectenByInformatieobjectUrl(caseDocumentId, doc1Url))
            .thenReturn(listOf(doc1, otherZaakDoc))

        service.deleteRelatedInformatieObjecten(caseDocumentId, documentUrl)

        verify(documentenApiService, times(0)).deleteInformatieObject(any(), any())
        verify(zaakApiPlugin).deleteZaakInformatieobject(relationUrl, caseDocumentId)
    }

    private fun createZaakInformatieObjecten(zaakUrl: URI, count: Int = 5): List<ZaakInformatieObject> {
        return IntRange(0, count - 1)
            .map { index ->
                ZaakInformatieObject(
                    url = createUrl(zaakUrl, "/$index/f5abe5c3-a36c-485b-9935-407e69bae231"),
                    uuid = UUID.randomUUID(),
                    informatieobject = createUrl(zaakUrl, "/$index/b059092c-9557-431a-9118-97f147903270"),
                    zaak = zaakUrl,
                    aardRelatieWeergave = "...",
                    registratiedatum = LocalDateTime.now()
                )
            }
    }

    private fun createUrl(baseUrl: URI, path: String): URI {
        return URI("$baseUrl$path")
    }

    private fun createDocumentInformatieObject(uri: URI) = DocumentInformatieObject(
        url = uri,
        bronorganisatie = Rsin("404797441"),
        auteur = "y",
        beginRegistratie = LocalDateTime.now(),
        creatiedatum = LocalDate.now(),
        taal = "nl",
        titel = "titel",
        versie = 1,
        informatieobjecttype = "http://localhost/informatieobjecttype",
    )

    @Test
    fun `should throw exception when deleting informatieObject that is not related to zaak`() {
        val caseDocumentId = UUID.randomUUID()
        val pluginConfigurationId = UUID.randomUUID()
        val documentId = UUID.randomUUID().toString()
        val zaakUrl = URI("https://example.com/zaken/$caseDocumentId")
        val informatieobjectUrl = URI("https://example.com/enkelvoudiginformatieobjecten/$documentId")

        whenever(zaakUrlProvider.getZaakUrl(caseDocumentId)).thenReturn(zaakUrl)

        val zakenApiPlugin = mock<ZakenApiPlugin>()
        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any()))
            .thenReturn(zakenApiPlugin)

        val documentenApiPlugin = mock<DocumentenApiPlugin>()
        whenever(pluginService.createInstance(eq(PluginConfigurationId.existingId(pluginConfigurationId))))
            .thenReturn(documentenApiPlugin)
        whenever(documentenApiPlugin.createInformatieObjectUrl(documentId))
            .thenReturn(informatieobjectUrl)

        // Return null to indicate no relation exists
        whenever(zakenApiPlugin.getZaakInformatieObject(caseDocumentId, zaakUrl, informatieobjectUrl))
            .thenReturn(null)

        val exception = assertThrows<IllegalArgumentException> {
            service.deleteInformatieObject(pluginConfigurationId.toString(), caseDocumentId, documentId)
        }

        assertEquals("InformatieObject is not related to this Zaak", exception.message)
        verify(documentenApiService, times(0)).deleteInformatieObject(any<String>(), any<UUID>(), any<String>())
    }

    @Test
    fun `should throw exception when modifying informatieObject that is not related to zaak`() {
        val caseDocumentId = UUID.randomUUID()
        val pluginConfigurationId = UUID.randomUUID()
        val documentId = UUID.randomUUID().toString()
        val zaakUrl = URI("https://example.com/zaken/$caseDocumentId")
        val informatieobjectUrl = URI("https://example.com/enkelvoudiginformatieobjecten/$documentId")
        modifyDocumentRequest = mock()

        whenever(zaakUrlProvider.getZaakUrl(caseDocumentId)).thenReturn(zaakUrl)

        val zakenApiPlugin = mock<ZakenApiPlugin>()
        whenever(pluginService.createInstance(eq(ZakenApiPlugin::class.java), any()))
            .thenReturn(zakenApiPlugin)

        val documentenApiPlugin = mock<DocumentenApiPlugin>()
        whenever(pluginService.createInstance(eq(PluginConfigurationId.existingId(pluginConfigurationId))))
            .thenReturn(documentenApiPlugin)
        whenever(documentenApiPlugin.createInformatieObjectUrl(documentId))
            .thenReturn(informatieobjectUrl)

        // Return null to indicate no relation exists
        whenever(zakenApiPlugin.getZaakInformatieObject(caseDocumentId, zaakUrl, informatieobjectUrl))
            .thenReturn(null)

        val exception = assertThrows<IllegalArgumentException> {
            service.modifyInformatieObject(pluginConfigurationId.toString(), caseDocumentId, documentId, modifyDocumentRequest)
        }

        assertEquals("InformatieObject is not related to this Zaak", exception.message)
        verify(documentenApiService, times(0)).modifyInformatieObject(any<String>(), any(), any<String>(), any())
    }
}