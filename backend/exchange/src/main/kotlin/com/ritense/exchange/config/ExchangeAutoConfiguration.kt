/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

package com.ritense.exchange.config

import com.ritense.exchange.client.ExchangeClient
import com.ritense.exchange.security.ExchangeHttpSecurityConfigurer
import com.ritense.exchange.service.ExchangeInstallService
import com.ritense.exchange.web.rest.ExchangeResource
import com.ritense.exporter.manifest.ValtimoVersionResolver
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.web.client.RestClient

@AutoConfiguration
@EnableConfigurationProperties(ExchangeProperties::class)
class ExchangeAutoConfiguration {

    /**
     * Timeouts are mandatory: downloads run on request threads, so an unresponsive Exchange must
     * fail fast instead of holding a thread.
     */
    @Bean
    @ConditionalOnMissingBean(ExchangeClient::class)
    fun exchangeClient(properties: ExchangeProperties): ExchangeClient {
        val requestFactory = SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(properties.connectTimeout)
            setReadTimeout(properties.readTimeout)
        }
        val builder = RestClient.builder().requestFactory(requestFactory)
        properties.baseUrl?.let { builder.baseUrl(it) }
        return ExchangeClient(builder.build(), properties.maxArtifactSize.toBytes())
    }

    @Bean
    @ConditionalOnMissingBean(ExchangeInstallService::class)
    fun exchangeInstallService(
        properties: ExchangeProperties,
        client: ExchangeClient,
        valtimoVersionResolver: ValtimoVersionResolver,
    ) = ExchangeInstallService(properties, client, valtimoVersionResolver)

    @Bean
    @ConditionalOnMissingBean(ExchangeResource::class)
    fun exchangeResource(service: ExchangeInstallService) = ExchangeResource(service)

    @Bean
    @Order(300)
    @ConditionalOnMissingBean(ExchangeHttpSecurityConfigurer::class)
    fun exchangeHttpSecurityConfigurer() = ExchangeHttpSecurityConfigurer()
}
