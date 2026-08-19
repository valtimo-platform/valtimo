package com.ritense.documentenapiwopi.autoconfigure

import com.ritense.documentenapiwopi.web.rest.DocumentenApiWopiResource
import com.ritense.documentenapiwopi.DocumentenApiWopiPluginFactory
import com.ritense.documentenapiwopi.client.WopiClient
import com.ritense.documentenapiwopi.security.DocumentenApiWopiHttpSecurityConfigurer
import com.ritense.documentenapiwopi.service.DocumentenApiWopiService
import com.ritense.plugin.service.PluginService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.web.client.RestClient

@AutoConfiguration
open class DocumentenApiWopiAutoConfiguration {
    @Bean
    fun wopiClient(
        restClientBuilder: RestClient.Builder,
    ) = WopiClient(restClientBuilder)

    @Bean
    @ConditionalOnMissingBean(DocumentenApiWopiPluginFactory::class)
    fun documentenApiWopiPluginFactory(
        wopiClient: WopiClient,
        pluginService: PluginService
    ): DocumentenApiWopiPluginFactory {
        return DocumentenApiWopiPluginFactory(
            wopiClient,
            pluginService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(DocumentenApiWopiService::class)
    fun documentenWopiApiService(
        pluginService: PluginService,
    ): DocumentenApiWopiService {
        return DocumentenApiWopiService(
            pluginService
        )
    }

    @Bean
    @ConditionalOnMissingBean(DocumentenApiWopiResource::class)
    fun documentenApiWopiResource(
        documentenApiWopiService: DocumentenApiWopiService,
    ): DocumentenApiWopiResource {
        return DocumentenApiWopiResource(
            documentenApiWopiService
        )
    }

    @Order(380)
    @Bean
    fun documentenApiWopiHttpSecurityConfigurer(): DocumentenApiWopiHttpSecurityConfigurer {
        return DocumentenApiWopiHttpSecurityConfigurer()
    }
}