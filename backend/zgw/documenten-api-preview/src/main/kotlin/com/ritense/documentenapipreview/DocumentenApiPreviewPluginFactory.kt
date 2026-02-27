package com.ritense.documentenapipreview

import com.ritense.documentenapipreview.client.PdfConversionClient
import com.ritense.plugin.PluginFactory
import com.ritense.plugin.service.PluginService
import org.springframework.stereotype.Component

@Component
class DocumentenApiPreviewPluginFactory(
    private val pdfConversionClient: PdfConversionClient,
    pluginService: PluginService) : PluginFactory<DocumentenApiPreviewPlugin>(pluginService) {

    override fun create(): DocumentenApiPreviewPlugin {
        return DocumentenApiPreviewPlugin(pdfConversionClient, pluginService)
    }
}