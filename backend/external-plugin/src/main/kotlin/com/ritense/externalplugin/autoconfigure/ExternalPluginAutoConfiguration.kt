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

package com.ritense.externalplugin.autoconfigure

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.externalplugin.endpoint.ExternalPluginEndpointDescriptionProvider
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.processlink.ExternalPluginProcessLinkMapper
import com.ritense.externalplugin.processlink.ExternalPluginServiceTaskStartListener
import com.ritense.externalplugin.processlink.ExternalPluginSupportedProcessLinkTypeHandler
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.externalplugin.security.ExternalPluginCallbackHttpSecurityConfigurer
import com.ritense.externalplugin.security.ExternalPluginEndpointAllowlistFilter
import com.ritense.externalplugin.security.ExternalPluginHttpSecurityConfigurer
import com.ritense.externalplugin.security.ExternalPluginServiceTokenAuthenticator
import com.ritense.externalplugin.security.ExternalPluginServiceTokenFilter
import com.ritense.externalplugin.security.ExternalPluginServiceTokenKeyProvider
import com.ritense.externalplugin.service.EndpointDescriptionService
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginDiscoveryJob
import com.ritense.externalplugin.service.ExternalPluginDiscoveryService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.externalplugin.service.ExternalPluginServiceTokenService
import com.ritense.externalplugin.service.PluginPropertyEncryptor
import com.ritense.externalplugin.web.rest.ExternalPluginManagementResource
import com.ritense.plugin.service.EncryptionService
import com.ritense.valueresolver.ValueResolverService
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.web.client.RestTemplate

@Configuration
@EnableScheduling
@EntityScan("com.ritense.externalplugin.domain")
@EnableJpaRepositories("com.ritense.externalplugin.repository")
class ExternalPluginAutoConfiguration {

    @Bean("externalPluginRestTemplate")
    @ConditionalOnMissingBean(name = ["externalPluginRestTemplate"])
    fun externalPluginRestTemplate(builder: RestTemplateBuilder): RestTemplate = builder.build()

    @Bean
    @ConditionalOnMissingBean(PluginPropertyEncryptor::class)
    fun pluginPropertyEncryptor(encryptionService: EncryptionService) =
        PluginPropertyEncryptor(encryptionService)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginHostClient::class)
    fun externalPluginHostClient(
        @org.springframework.beans.factory.annotation.Qualifier("externalPluginRestTemplate") restTemplate: RestTemplate,
        objectMapper: ObjectMapper,
    ) = ExternalPluginHostClient(restTemplate, objectMapper)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginHostService::class)
    fun externalPluginHostService(
        hostRepository: ExternalPluginHostRepository,
        encryptionService: EncryptionService,
        hostClient: ExternalPluginHostClient,
    ) = ExternalPluginHostService(hostRepository, encryptionService, hostClient)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginDefinitionService::class)
    fun externalPluginDefinitionService(definitionRepository: ExternalPluginDefinitionRepository) =
        ExternalPluginDefinitionService(definitionRepository)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginServiceTokenKeyProvider::class)
    fun externalPluginServiceTokenKeyProvider(
        @Value("\${valtimo.external-plugin.service-token-secret}") secret: String,
    ) = ExternalPluginServiceTokenKeyProvider(secret)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginServiceTokenService::class)
    fun externalPluginServiceTokenService(
        keyProvider: ExternalPluginServiceTokenKeyProvider,
    ) = ExternalPluginServiceTokenService(keyProvider)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginServiceTokenAuthenticator::class)
    fun externalPluginServiceTokenAuthenticator() = ExternalPluginServiceTokenAuthenticator()

    @Bean
    @ConditionalOnMissingBean(ExternalPluginEndpointAllowlistFilter::class)
    fun externalPluginEndpointAllowlistFilter(
        grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
    ) = ExternalPluginEndpointAllowlistFilter(grantedEndpointRepository)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginServiceTokenFilter::class)
    fun externalPluginServiceTokenFilter(
        keyProvider: ExternalPluginServiceTokenKeyProvider,
        authenticator: ExternalPluginServiceTokenAuthenticator,
    ) = ExternalPluginServiceTokenFilter(keyProvider, authenticator)

    @Bean
    @Order(450)
    @ConditionalOnMissingBean(ExternalPluginCallbackHttpSecurityConfigurer::class)
    fun externalPluginCallbackHttpSecurityConfigurer(
        serviceTokenFilter: ExternalPluginServiceTokenFilter,
        allowlistFilter: ExternalPluginEndpointAllowlistFilter,
    ) = ExternalPluginCallbackHttpSecurityConfigurer(serviceTokenFilter, allowlistFilter)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginConfigurationService::class)
    fun externalPluginConfigurationService(
        configurationRepository: ExternalPluginConfigurationRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
        hostRepository: ExternalPluginHostRepository,
        grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
        hostClient: ExternalPluginHostClient,
        propertyEncryptor: PluginPropertyEncryptor,
        encryptionService: EncryptionService,
        objectMapper: ObjectMapper,
        serviceTokenService: ExternalPluginServiceTokenService,
        @Value("\${valtimo.external-plugin.gzac-base-url}") gzacBaseUrl: String,
    ) = ExternalPluginConfigurationService(
        configurationRepository,
        definitionRepository,
        hostRepository,
        grantedEndpointRepository,
        hostClient,
        propertyEncryptor,
        encryptionService,
        objectMapper,
        serviceTokenService,
        gzacBaseUrl,
    )

    @Bean
    @ConditionalOnMissingBean(ExternalPluginDiscoveryService::class)
    fun externalPluginDiscoveryService(
        hostRepository: ExternalPluginHostRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
        configurationRepository: ExternalPluginConfigurationRepository,
        configurationService: ExternalPluginConfigurationService,
        hostService: ExternalPluginHostService,
        hostClient: ExternalPluginHostClient,
        @Value("\${valtimo.external-plugin.polling.failure-threshold:3}") failureThreshold: Int,
    ) = ExternalPluginDiscoveryService(hostRepository, definitionRepository, configurationRepository, configurationService, hostService, hostClient, failureThreshold)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginDiscoveryJob::class)
    fun externalPluginDiscoveryJob(discoveryService: ExternalPluginDiscoveryService) =
        ExternalPluginDiscoveryJob(discoveryService)

    @Bean
    @ConditionalOnMissingBean(EndpointDescriptionService::class)
    fun endpointDescriptionService(
        providers: List<EndpointDescriptionProvider>,
    ) = EndpointDescriptionService(providers)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginManagementResource::class)
    fun externalPluginManagementResource(
        hostService: ExternalPluginHostService,
        definitionService: ExternalPluginDefinitionService,
        configurationService: ExternalPluginConfigurationService,
        endpointDescriptionService: EndpointDescriptionService,
    ) = ExternalPluginManagementResource(hostService, definitionService, configurationService, endpointDescriptionService)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginProcessLinkMapper::class)
    fun externalPluginProcessLinkMapper(objectMapper: ObjectMapper) =
        ExternalPluginProcessLinkMapper(objectMapper)

    @Bean
    @Order(40)
    @ConditionalOnMissingBean(ExternalPluginSupportedProcessLinkTypeHandler::class)
    fun externalPluginSupportedProcessLinkTypeHandler() = ExternalPluginSupportedProcessLinkTypeHandler()

    @Bean
    @ConditionalOnMissingBean(ExternalPluginServiceTaskStartListener::class)
    fun externalPluginServiceTaskStartListener(
        processLinkRepository: ExternalPluginProcessLinkRepository,
        configurationService: ExternalPluginConfigurationService,
        definitionService: ExternalPluginDefinitionService,
        hostService: ExternalPluginHostService,
        hostClient: ExternalPluginHostClient,
        valueResolverService: ValueResolverService,
        objectMapper: ObjectMapper,
    ) = ExternalPluginServiceTaskStartListener(
        processLinkRepository,
        configurationService,
        definitionService,
        hostService,
        hostClient,
        valueResolverService,
        objectMapper,
    )

    @Bean
    @Order(430)
    @ConditionalOnMissingBean(ExternalPluginHttpSecurityConfigurer::class)
    fun externalPluginHttpSecurityConfigurer() = ExternalPluginHttpSecurityConfigurer()

    @Bean
    @ConditionalOnMissingBean(ExternalPluginEndpointDescriptionProvider::class)
    fun externalPluginEndpointDescriptionProvider() = ExternalPluginEndpointDescriptionProvider()
}
