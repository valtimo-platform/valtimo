package com.ritense.documentenapipreview.autoconfigure

import com.ritense.documentenapipreview.DocumentenApiPreviewPluginFactory
import com.ritense.documentenapipreview.client.PdfConversionClient
import com.ritense.documentenapipreview.service.DocumentenApiPreviewService
import com.ritense.plugin.service.PluginService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean
import org.springframework.web.client.RestClient

@AutoConfiguration
open class DocumentenApiPreviewAutoConfiguration {

    @Bean
    fun pdfConversionClient(
        restClientBuilder: RestClient.Builder,
    ) = PdfConversionClient(restClientBuilder)

    @Bean
    @ConditionalOnMissingBean(DocumentenApiPreviewPluginFactory::class)
    fun documentenApiPreviewPluginFactory(
        pdfConversionClient: PdfConversionClient,
        pluginService: PluginService
    ): DocumentenApiPreviewPluginFactory {
        return DocumentenApiPreviewPluginFactory(
            pdfConversionClient,
            pluginService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(DocumentenApiPreviewService::class)
    fun documentenPreviewApiService(
        pluginService: PluginService,
    ): DocumentenApiPreviewService {
        return DocumentenApiPreviewService(
            pluginService
        )
    }
}