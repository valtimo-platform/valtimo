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

package com.ritense.documentenapipreview

import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapi.client.DocumentInformatieObject
import com.ritense.documentenapipreview.client.PdfConversionClient
import com.ritense.plugin.service.PluginService
import com.ritense.zgw.Rsin
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.net.URI
import java.time.LocalDate
import java.time.LocalDateTime

class DocumentenApiPreviewPluginTest {
    private lateinit var documentenApiPreviewPlugin: DocumentenApiPreviewPlugin
    private lateinit var documentenApiPlugin: DocumentenApiPlugin
    private lateinit var pdfConversionClient: PdfConversionClient
    private lateinit var pluginService: PluginService

    @BeforeEach
    fun before() {
        documentenApiPlugin = mock<DocumentenApiPlugin>()
        pdfConversionClient = mock<PdfConversionClient>()
        pluginService = mock<PluginService>()

        documentenApiPreviewPlugin = DocumentenApiPreviewPlugin(pdfConversionClient, pluginService)
        documentenApiPreviewPlugin.documentenApiConfigurationId = "mock_documenten_api_configuration_id"
        documentenApiPreviewPlugin.pdfConversionUrl = URI("http://mock.url")

        whenever(pluginService.createInstance<DocumentenApiPlugin>(documentenApiPreviewPlugin.documentenApiConfigurationId))
            .thenReturn(documentenApiPlugin)
        whenever(documentenApiPlugin.downloadInformatieObject(null,MOCK_DOCUMENT_ID))
            .thenReturn(MOCK_DOCUMENT_STREAM)
        whenever(documentenApiPlugin.getInformatieObject(MOCK_DOCUMENT_ID, null))
            .thenReturn(MOCK_DOCUMENT_INFORMATIE_OBJECT)
        whenever(pdfConversionClient.convertDocument(any(), any(), any())).thenReturn(MOCK_DOCUMENT_STREAM)
    }

    @Test
    fun `should call download on DocumentenApiPlugin`() {
        documentenApiPreviewPlugin.generatePreview(MOCK_DOCUMENT_ID)

        verify(documentenApiPlugin).downloadInformatieObject(null,MOCK_DOCUMENT_ID)
    }

    @Test
    fun `should call getInformatieObject on DocumentenApiPlugin`() {
        documentenApiPreviewPlugin.generatePreview(MOCK_DOCUMENT_ID)

        verify(documentenApiPlugin).getInformatieObject(MOCK_DOCUMENT_ID, null)
    }

    @Test
    fun `should call generatePreview on PdfConversionClient`() {
        documentenApiPreviewPlugin.generatePreview(MOCK_DOCUMENT_ID)

        verify(pdfConversionClient).convertDocument(documentenApiPreviewPlugin.pdfConversionUrl, MOCK_DOCUMENT_STREAM, any())
    }

    companion object {
        private val MOCK_DOCUMENT_ID = "mock_document_identifier"

        private val MOCK_DOCUMENT_STREAM = "test_document".byteInputStream()
        private val MOCK_DOCUMENT_INFORMATIE_OBJECT = DocumentInformatieObject(
            url = URI("http://mock.url/mock_document"),
            bronorganisatie = Rsin("001326132"),
            identificatie = null,
            creatiedatum = LocalDate.now(),
            titel = "Mock titel",
            vertrouwelijkheidaanduiding = null,
            auteur = "Mock auteur",
            status = null,
            formaat = null,
            taal = "Mock taal",
            versie = null,
            beginRegistratie = LocalDateTime.now(),
            bestandsnaam = "mock_document.docx",
            bestandsomvang = null,
            link = null,
            beschrijving = null,
            ontvangstdatum = null,
            verzenddatum = null,
            indicatieGebruiksrecht = null,
            informatieobjecttype = null,
            trefwoorden = null
        )
    }
}