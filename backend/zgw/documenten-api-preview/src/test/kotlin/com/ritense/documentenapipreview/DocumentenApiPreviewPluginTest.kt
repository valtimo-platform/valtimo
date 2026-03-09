package com.ritense.documentenapipreview

import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapipreview.client.PdfConversionClient
import com.ritense.plugin.service.PluginService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.net.URI

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
        documentenApiPreviewPlugin.url = URI("http://mock.url")

        whenever(pluginService.createInstance<DocumentenApiPlugin>(documentenApiPreviewPlugin.documentenApiConfigurationId))
            .thenReturn(documentenApiPlugin)
    }

    @Test
    fun `should call download on DocumentenApiPlugin`() {
        val documentId = "mock_document_identifier"

        whenever(documentenApiPlugin.downloadInformatieObject(documentId))
            .thenReturn("test_document".byteInputStream())

        documentenApiPreviewPlugin.generatePreview(documentId)

        verify(documentenApiPlugin).downloadInformatieObject(documentId)
    }

    @Test
    fun `should call generatePreview on PdfConversionClient`() {
        val documentId = "mock_document_identifier"
        val documentStream = "test_document".byteInputStream()

        whenever(documentenApiPlugin.downloadInformatieObject(documentId))
            .thenReturn(documentStream)

        documentenApiPreviewPlugin.generatePreview(documentId)

        verify(pdfConversionClient).convertDocument(documentenApiPreviewPlugin.url, documentStream)
    }
}