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

package com.ritense.documentenapipreview.autoconfigure

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