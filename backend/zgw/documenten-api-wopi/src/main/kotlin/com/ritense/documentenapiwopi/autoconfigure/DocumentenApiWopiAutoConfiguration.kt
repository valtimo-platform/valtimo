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
    @ConditionalOnMissingBean(WopiClient::class)
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