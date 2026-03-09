package com.ritense.documentenapipreview.service

import com.ritense.documentenapipreview.DocumentenApiPreviewPlugin
import com.ritense.plugin.service.PluginService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class DocumentenApiPreviewServiceTest {
    private lateinit var documentenApiPreviewService: DocumentenApiPreviewService
    private lateinit var pluginService: PluginService

    @BeforeEach
    fun before() {
        pluginService = mock<PluginService>()

        documentenApiPreviewService = DocumentenApiPreviewService(pluginService)
    }

    @Test
    fun `should call plugin to generate preview for document`() {
        val documentApiConfigurationId = "dummy_document_api_configuration_id"
        val documentId = "dummy_document_identifier"
        val pluginInstance = mock<DocumentenApiPreviewPlugin>()
        whenever(pluginService
            .createInstance<DocumentenApiPreviewPlugin>(any(), any()))
            .thenReturn(pluginInstance)

        documentenApiPreviewService.generatePreview(documentApiConfigurationId, documentId)

        verify(pluginInstance).generatePreview(documentId)
    }
}