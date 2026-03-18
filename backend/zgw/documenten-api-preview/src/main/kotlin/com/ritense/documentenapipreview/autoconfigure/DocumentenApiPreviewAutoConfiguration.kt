package com.ritense.documentenapipreview.autoconfigure

import com.ritense.documentenapi.security.DocumentenApiHttpSecurityConfigurer
import com.ritense.documentenapipreview.DocumentenApiPreviewPluginFactory
import com.ritense.documentenapipreview.client.PdfConversionClient
import com.ritense.documentenapipreview.security.DocumentenApiPreviewHttpSecurityConfigurer
import com.ritense.documentenapipreview.service.DocumentenApiPreviewService
import com.ritense.documentenapipreview.web.rest.DocumentenApiPreviewResource
import com.ritense.plugin.service.PluginService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
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

    @Bean
    @ConditionalOnMissingBean(DocumentenApiPreviewResource::class)
    fun documentenApiPreviewResource(
        documentenApiPreviewService: DocumentenApiPreviewService,
    ): DocumentenApiPreviewResource {
        return DocumentenApiPreviewResource(
            documentenApiPreviewService
        )
    }

    @Order(380)
    @Bean
    fun documentenApiPreviewHttpSecurityConfigurer(): DocumentenApiPreviewHttpSecurityConfigurer {
        return DocumentenApiPreviewHttpSecurityConfigurer()
    }


}