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
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.compatibility.DefaultGzacVersionProvider
import com.ritense.externalplugin.compatibility.GzacCompatibilityChecker
import com.ritense.externalplugin.compatibility.GzacVersionProvider
import com.ritense.externalplugin.compatibility.PluginPackageInspector
import com.ritense.externalplugin.processlink.ExternalPluginProcessLinkMapper
import com.ritense.externalplugin.processlink.ExternalPluginServiceTaskStartListener
import com.ritense.externalplugin.processlink.ExternalPluginSupportedProcessLinkTypeHandler
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.externalplugin.security.ExternalPluginCallbackHttpSecurityConfigurer
import com.ritense.externalplugin.security.ExternalPluginEndpointAllowlistFilter
import com.ritense.externalplugin.security.ExternalPluginHttpSecurityConfigurer
import com.ritense.externalplugin.security.ExternalPluginServiceTokenAuthenticator
import com.ritense.externalplugin.security.ExternalPluginServiceTokenFilter
import com.ritense.externalplugin.security.ExternalPluginServiceTokenKeyProvider
import com.ritense.externalplugin.security.ExternalPluginUserTokenAuthenticator
import com.ritense.externalplugin.security.ExternalPluginUserTokenFilter
import com.ritense.externalplugin.security.ExternalPluginUserTokenKeyProvider
import com.ritense.externalplugin.service.EndpointDescriptionService
import com.ritense.externalplugin.service.ExternalPluginBundleUrlResolver
import com.ritense.externalplugin.service.ExternalPluginCaseTabResolverImpl
import com.ritense.externalplugin.service.ExternalPluginConfigurationService
import com.ritense.externalplugin.service.ExternalPluginDefinitionService
import com.ritense.externalplugin.service.ExternalPluginDiscoveryJob
import com.ritense.externalplugin.service.ExternalPluginDiscoveryService
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.externalplugin.service.ExternalPluginHostUsageResolver
import com.ritense.externalplugin.service.ExternalPluginMenuPageService
import com.ritense.externalplugin.service.ExternalPluginServiceTokenService
import com.ritense.externalplugin.service.ExternalPluginUserTokenService
import com.ritense.externalplugin.service.PluginPropertyEncryptor
import com.ritense.externalplugin.web.rest.ExternalPluginManagementResource
import com.ritense.externalplugin.web.rest.ExternalPluginMenuPageResource
import com.ritense.externalplugin.web.rest.ExternalPluginUserTokenResource
import com.ritense.plugin.service.EncryptionService
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valueresolver.ValueResolverService
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.convert.DurationStyle
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.web.client.RestTemplate
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping

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
    @ConditionalOnMissingBean(ExternalPluginHostUsageResolver::class)
    fun externalPluginHostUsageResolver(
        definitionRepository: ExternalPluginDefinitionRepository,
        configurationRepository: ExternalPluginConfigurationRepository,
        processLinkRepository: ExternalPluginProcessLinkRepository,
        operatonRepositoryService: OperatonRepositoryService,
        bpmnRepositoryService: RepositoryService,
        caseExternalPluginTabService: java.util.Optional<com.ritense.case_.service.CaseExternalPluginTabService>,
    ) = ExternalPluginHostUsageResolver(
        definitionRepository,
        configurationRepository,
        processLinkRepository,
        operatonRepositoryService,
        bpmnRepositoryService,
        caseExternalPluginTabService,
    )

    @Bean
    @ConditionalOnMissingBean(ExternalPluginHostService::class)
    fun externalPluginHostService(
        hostRepository: ExternalPluginHostRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
        configurationRepository: ExternalPluginConfigurationRepository,
        grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
        grantedEventRepository: ExternalPluginGrantedEventRepository,
        encryptionService: EncryptionService,
        hostClient: ExternalPluginHostClient,
        hostUsageResolver: ExternalPluginHostUsageResolver,
    ) = ExternalPluginHostService(
        hostRepository,
        definitionRepository,
        configurationRepository,
        grantedEndpointRepository,
        grantedEventRepository,
        encryptionService,
        hostClient,
        hostUsageResolver,
    )

    @Bean
    @ConditionalOnMissingBean(ExternalPluginDefinitionService::class)
    fun externalPluginDefinitionService(definitionRepository: ExternalPluginDefinitionRepository) =
        ExternalPluginDefinitionService(definitionRepository)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginBundleUrlResolver::class)
    fun externalPluginBundleUrlResolver(
        configurationRepository: ExternalPluginConfigurationRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
    ) = ExternalPluginBundleUrlResolver(configurationRepository, definitionRepository)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginCaseTabResolverImpl::class)
    fun externalPluginCaseTabResolver(
        bundleUrlResolver: ExternalPluginBundleUrlResolver,
    ) = ExternalPluginCaseTabResolverImpl(bundleUrlResolver)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginMenuPageService::class)
    fun externalPluginMenuPageService(
        configurationRepository: ExternalPluginConfigurationRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
        bundleUrlResolver: ExternalPluginBundleUrlResolver,
    ) = ExternalPluginMenuPageService(configurationRepository, definitionRepository, bundleUrlResolver)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginMenuPageResource::class)
    fun externalPluginMenuPageResource(
        menuPageService: ExternalPluginMenuPageService,
    ) = ExternalPluginMenuPageResource(menuPageService)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginServiceTokenKeyProvider::class)
    fun externalPluginServiceTokenKeyProvider(
        @Value("\${valtimo.plugin.encryption-secret}") secret: String,
    ) = ExternalPluginServiceTokenKeyProvider(secret)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginServiceTokenService::class)
    fun externalPluginServiceTokenService(
        keyProvider: ExternalPluginServiceTokenKeyProvider,
        @Value("\${valtimo.external-plugin.service-token.ttl:PT24H}") tokenTtl: String,
    ) = ExternalPluginServiceTokenService(keyProvider, DurationStyle.detectAndParse(tokenTtl))

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
    @ConditionalOnMissingBean(ExternalPluginUserTokenKeyProvider::class)
    fun externalPluginUserTokenKeyProvider(
        @Value("\${valtimo.plugin.encryption-secret}") secret: String,
    ) = ExternalPluginUserTokenKeyProvider(secret)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginUserTokenService::class)
    fun externalPluginUserTokenService(
        keyProvider: ExternalPluginUserTokenKeyProvider,
        @Value("\${valtimo.external-plugin.user-token.ttl:PT15M}") tokenTtl: String,
    ) = ExternalPluginUserTokenService(keyProvider, DurationStyle.detectAndParse(tokenTtl))

    @Bean
    @ConditionalOnMissingBean(ExternalPluginUserTokenAuthenticator::class)
    fun externalPluginUserTokenAuthenticator() = ExternalPluginUserTokenAuthenticator()

    @Bean
    @ConditionalOnMissingBean(ExternalPluginUserTokenFilter::class)
    fun externalPluginUserTokenFilter(
        keyProvider: ExternalPluginUserTokenKeyProvider,
        authenticator: ExternalPluginUserTokenAuthenticator,
    ) = ExternalPluginUserTokenFilter(keyProvider, authenticator)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginUserTokenResource::class)
    fun externalPluginUserTokenResource(
        configurationRepository: ExternalPluginConfigurationRepository,
        userTokenService: ExternalPluginUserTokenService,
    ) = ExternalPluginUserTokenResource(configurationRepository, userTokenService)

    @Bean
    @Order(450)
    @ConditionalOnMissingBean(ExternalPluginCallbackHttpSecurityConfigurer::class)
    fun externalPluginCallbackHttpSecurityConfigurer(
        serviceTokenFilter: ExternalPluginServiceTokenFilter,
        userTokenFilter: ExternalPluginUserTokenFilter,
        allowlistFilter: ExternalPluginEndpointAllowlistFilter,
    ) = ExternalPluginCallbackHttpSecurityConfigurer(serviceTokenFilter, userTokenFilter, allowlistFilter)

    /**
     * The configuration service only needs two fallbacks:
     *
     * - `defaultEventBrokerExchange` reuses `valtimo.outbox.publisher.rabbitmq.exchange` — applied
     *   when a host row leaves `event_broker_exchange` null. New hosts almost never override this.
     * - `fallbackGzacBaseUrl` only kicks in for legacy host rows that pre-date the
     *   `gzac_callback_base_url` column. New hosts always carry the URL the admin entered.
     *
     * Everything else (callback URL, broker URL) is per-host and read off the host row at push
     * time. The add-host form fetches sensible pre-fills from `HostDefaultsResource`.
     */
    @Bean
    @ConditionalOnMissingBean(ExternalPluginConfigurationService::class)
    fun externalPluginConfigurationService(
        configurationRepository: ExternalPluginConfigurationRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
        hostRepository: ExternalPluginHostRepository,
        grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
        grantedEventRepository: ExternalPluginGrantedEventRepository,
        hostClient: ExternalPluginHostClient,
        propertyEncryptor: PluginPropertyEncryptor,
        encryptionService: EncryptionService,
        objectMapper: ObjectMapper,
        serviceTokenService: ExternalPluginServiceTokenService,
        hostUsageResolver: ExternalPluginHostUsageResolver,
        @Value("\${server.port:8080}") serverPort: Int,
        @Value("\${valtimo.outbox.publisher.rabbitmq.exchange:valtimo-events}") defaultEventBrokerExchange: String,
    ) = ExternalPluginConfigurationService(
        configurationRepository,
        definitionRepository,
        hostRepository,
        grantedEndpointRepository,
        grantedEventRepository,
        hostClient,
        propertyEncryptor,
        encryptionService,
        objectMapper,
        serviceTokenService,
        hostUsageResolver,
        defaultEventBrokerExchange,
        "http://localhost:$serverPort",
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
        handlerMappings: List<RequestMappingHandlerMapping>,
    ) = EndpointDescriptionService(handlerMappings)

    @Bean
    @ConditionalOnMissingBean(GzacVersionProvider::class)
    fun gzacVersionProvider(
        @Value("\${valtimo.external-plugin.gzac-version:}") versionOverride: String,
    ): GzacVersionProvider = DefaultGzacVersionProvider(
        versionOverride,
        DefaultGzacVersionProvider::class.java.`package`?.implementationVersion,
    )

    @Bean
    @ConditionalOnMissingBean(GzacCompatibilityChecker::class)
    fun gzacCompatibilityChecker(versionProvider: GzacVersionProvider) =
        GzacCompatibilityChecker(versionProvider)

    @Bean
    @ConditionalOnMissingBean(PluginPackageInspector::class)
    fun pluginPackageInspector(objectMapper: ObjectMapper) = PluginPackageInspector(objectMapper)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginManagementResource::class)
    fun externalPluginManagementResource(
        hostService: ExternalPluginHostService,
        definitionService: ExternalPluginDefinitionService,
        configurationService: ExternalPluginConfigurationService,
        endpointDescriptionService: EndpointDescriptionService,
        discoveryService: ExternalPluginDiscoveryService,
        environment: org.springframework.core.env.Environment,
        compatibilityChecker: GzacCompatibilityChecker,
        pluginPackageInspector: PluginPackageInspector,
        objectMapper: ObjectMapper,
    ) = ExternalPluginManagementResource(
        hostService,
        definitionService,
        configurationService,
        endpointDescriptionService,
        discoveryService,
        environment,
        compatibilityChecker,
        pluginPackageInspector,
        objectMapper,
    )

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
}
