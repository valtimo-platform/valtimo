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
import com.ritense.case.repository.CaseTabRepository
import com.ritense.case_.repository.CaseExternalPluginTabRepository
import com.ritense.externalplugin.client.ExternalPluginHostClient
import com.ritense.externalplugin.compatibility.DefaultGzacVersionProvider
import com.ritense.externalplugin.compatibility.GzacCompatibilityChecker
import com.ritense.externalplugin.compatibility.GzacVersionProvider
import com.ritense.externalplugin.compatibility.PluginPackageInspector
import com.ritense.externalplugin.preview.ExternalPluginImportPreviewContributor
import com.ritense.externalplugin.processlink.ExternalPluginProcessLinkMapper
import com.ritense.externalplugin.processlink.ExternalPluginServiceTaskStartListener
import com.ritense.externalplugin.processlink.ExternalPluginSupportedProcessLinkTypeHandler
import com.ritense.externalplugin.processlink.ExternalPluginTaskFormProcessLinkActivityHandler
import com.ritense.externalplugin.processlink.ExternalPluginTaskFormProcessLinkMapper
import com.ritense.externalplugin.processlink.ExternalPluginTaskFormSubmissionService
import com.ritense.externalplugin.processlink.ExternalPluginTaskFormSupportedProcessLinkTypeHandler
import com.ritense.externalplugin.processlink.web.ExternalPluginTaskFormSubmissionResource
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.repository.ExternalPluginDefinitionRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedCapabilityRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import com.ritense.externalplugin.repository.ExternalPluginGrantedEventRepository
import com.ritense.externalplugin.repository.ExternalPluginHostRepository
import com.ritense.externalplugin.repository.ExternalPluginProcessLinkRepository
import com.ritense.externalplugin.repository.ExternalPluginTaskFormProcessLinkRepository
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
import com.ritense.externalplugin.service.ExternalPluginCaseWidgetResolverImpl
import com.ritense.externalplugin.service.ExternalPluginConfigurationMappingResolver
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
import com.ritense.externalplugin.web.rest.ExternalPluginHostOriginsResource
import com.ritense.externalplugin.web.rest.ExternalPluginManagementResource
import com.ritense.externalplugin.web.rest.ExternalPluginMenuPageResource
import com.ritense.externalplugin.web.rest.ExternalPluginUserTokenIntrospectionResource
import com.ritense.externalplugin.web.rest.ExternalPluginUserTokenResource
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.plugin.service.EncryptionService
import com.ritense.plugin.service.PluginActionResultHandler
import com.ritense.plugin.service.ProcessDefinitionUsageMetaResolver
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.importer.ImportPreviewContributor
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import com.ritense.valueresolver.ValueResolverService
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.convert.DurationStyle
import org.springframework.boot.web.client.RestTemplateBuilder
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import org.springframework.web.client.RestTemplate
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping

// @EnableScheduling stays even though this is an @AutoConfiguration: the discovery job's @Scheduled
// method needs a ScheduledAnnotationBeanPostProcessor, which no other module is guaranteed to
// contribute (same pattern as DocumentOpenSearchAutoConfiguration).
@AutoConfiguration
@EnableScheduling
@EntityScan("com.ritense.externalplugin.domain")
@EnableJpaRepositories("com.ritense.externalplugin.repository")
class ExternalPluginAutoConfiguration {

    /**
     * RestTemplate for all GZAC→host calls. Timeouts are mandatory: host calls run on request
     * threads and in the discovery cycle, so an unresponsive host must fail fast instead of
     * hanging a thread (or, worse, a transaction) indefinitely.
     */
    @Bean("externalPluginRestTemplate")
    @ConditionalOnMissingBean(name = ["externalPluginRestTemplate"])
    fun externalPluginRestTemplate(
        builder: RestTemplateBuilder,
        @Value("\${valtimo.external-plugin.connect-timeout:PT2S}") connectTimeout: String,
        @Value("\${valtimo.external-plugin.read-timeout:PT10S}") readTimeout: String,
    ): RestTemplate = builder
        .connectTimeout(DurationStyle.detectAndParse(connectTimeout))
        .readTimeout(DurationStyle.detectAndParse(readTimeout))
        .build()

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
        taskFormProcessLinkRepository: ExternalPluginTaskFormProcessLinkRepository,
        processDefinitionUsageMetaResolver: ProcessDefinitionUsageMetaResolver,
        caseExternalPluginTabService: java.util.Optional<com.ritense.case_.service.CaseExternalPluginTabService>,
        caseExternalPluginWidgetService: java.util.Optional<com.ritense.case_.service.CaseExternalPluginWidgetService>,
        buildingBlockMappingUsageFinder: java.util.Optional<com.ritense.plugin.service.BuildingBlockPluginMappingUsageFinder>,
    ) = ExternalPluginHostUsageResolver(
        definitionRepository,
        configurationRepository,
        processLinkRepository,
        taskFormProcessLinkRepository,
        processDefinitionUsageMetaResolver,
        caseExternalPluginTabService,
        caseExternalPluginWidgetService,
        buildingBlockMappingUsageFinder,
    )

    @Bean
    @ConditionalOnMissingBean(ExternalPluginHostService::class)
    fun externalPluginHostService(
        hostRepository: ExternalPluginHostRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
        configurationRepository: ExternalPluginConfigurationRepository,
        grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
        grantedEventRepository: ExternalPluginGrantedEventRepository,
        grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository,
        encryptionService: EncryptionService,
        hostClient: ExternalPluginHostClient,
        hostUsageResolver: ExternalPluginHostUsageResolver,
    ) = ExternalPluginHostService(
        hostRepository,
        definitionRepository,
        configurationRepository,
        grantedEndpointRepository,
        grantedEventRepository,
        grantedCapabilityRepository,
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
        configurationRepository: ExternalPluginConfigurationRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
    ) = ExternalPluginCaseTabResolverImpl(bundleUrlResolver, configurationRepository, definitionRepository)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginCaseWidgetResolverImpl::class)
    fun externalPluginCaseWidgetResolver(
        bundleUrlResolver: ExternalPluginBundleUrlResolver,
        configurationRepository: ExternalPluginConfigurationRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
    ) = ExternalPluginCaseWidgetResolverImpl(bundleUrlResolver, configurationRepository, definitionRepository)

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
    @ConditionalOnMissingBean(ExternalPluginHostOriginsResource::class)
    fun externalPluginHostOriginsResource(
        hostService: ExternalPluginHostService,
    ) = ExternalPluginHostOriginsResource(hostService)

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

    /**
     * The three external-plugin filters are exposed as `Filter`-typed beans (so the security
     * configurer can insert them at the right position in the Spring Security chain), which means
     * Spring Boot would *also* auto-register each of them as a plain servlet filter running on
     * every request. These disabled registrations suppress that second, chain-independent
     * registration — the filters must only ever run inside the security filter chain.
     */
    @Bean
    fun externalPluginServiceTokenFilterRegistration(
        filter: ExternalPluginServiceTokenFilter,
    ): FilterRegistrationBean<ExternalPluginServiceTokenFilter> =
        FilterRegistrationBean(filter).apply { isEnabled = false }

    @Bean
    fun externalPluginUserTokenFilterRegistration(
        filter: ExternalPluginUserTokenFilter,
    ): FilterRegistrationBean<ExternalPluginUserTokenFilter> =
        FilterRegistrationBean(filter).apply { isEnabled = false }

    @Bean
    fun externalPluginEndpointAllowlistFilterRegistration(
        filter: ExternalPluginEndpointAllowlistFilter,
    ): FilterRegistrationBean<ExternalPluginEndpointAllowlistFilter> =
        FilterRegistrationBean(filter).apply { isEnabled = false }

    @Bean
    @ConditionalOnMissingBean(ExternalPluginUserTokenResource::class)
    fun externalPluginUserTokenResource(
        configurationRepository: ExternalPluginConfigurationRepository,
        grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
        userTokenService: ExternalPluginUserTokenService,
    ) = ExternalPluginUserTokenResource(configurationRepository, grantedEndpointRepository, userTokenService)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginUserTokenIntrospectionResource::class)
    fun externalPluginUserTokenIntrospectionResource(
        keyProvider: ExternalPluginUserTokenKeyProvider,
    ) = ExternalPluginUserTokenIntrospectionResource(keyProvider)

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
        grantedCapabilityRepository: ExternalPluginGrantedCapabilityRepository,
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
        grantedCapabilityRepository,
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
        transactionManager: PlatformTransactionManager,
        @Value("\${valtimo.external-plugin.polling.failure-threshold:3}") failureThreshold: Int,
    ) = ExternalPluginDiscoveryService(
        hostRepository,
        definitionRepository,
        configurationRepository,
        configurationService,
        hostService,
        hostClient,
        TransactionTemplate(transactionManager),
        failureThreshold,
    )

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
        hostClient: ExternalPluginHostClient,
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
        hostClient,
        endpointDescriptionService,
        discoveryService,
        environment,
        compatibilityChecker,
        pluginPackageInspector,
        objectMapper,
    )

    @Bean
    @ConditionalOnMissingBean(ExternalPluginProcessLinkMapper::class)
    fun externalPluginProcessLinkMapper(
        objectMapper: ObjectMapper,
        configurationRepository: ExternalPluginConfigurationRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
        processLinkRepository: ExternalPluginProcessLinkRepository,
    ) = ExternalPluginProcessLinkMapper(objectMapper, configurationRepository, definitionRepository, processLinkRepository)

    @Bean
    @Order(40)
    @ConditionalOnMissingBean(ExternalPluginSupportedProcessLinkTypeHandler::class)
    fun externalPluginSupportedProcessLinkTypeHandler() = ExternalPluginSupportedProcessLinkTypeHandler()

    @Bean
    @ConditionalOnMissingBean(ExternalPluginTaskFormProcessLinkMapper::class)
    fun externalPluginTaskFormProcessLinkMapper(
        objectMapper: ObjectMapper,
        configurationRepository: ExternalPluginConfigurationRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
        taskFormProcessLinkRepository: ExternalPluginTaskFormProcessLinkRepository,
    ) = ExternalPluginTaskFormProcessLinkMapper(objectMapper, configurationRepository, definitionRepository, taskFormProcessLinkRepository)

    @Bean
    @Order(41)
    @ConditionalOnMissingBean(ExternalPluginTaskFormSupportedProcessLinkTypeHandler::class)
    fun externalPluginTaskFormSupportedProcessLinkTypeHandler() = ExternalPluginTaskFormSupportedProcessLinkTypeHandler()

    @Bean
    @ConditionalOnMissingBean(ExternalPluginTaskFormProcessLinkActivityHandler::class)
    fun externalPluginTaskFormProcessLinkActivityHandler(
        bundleUrlResolver: ExternalPluginBundleUrlResolver,
    ) = ExternalPluginTaskFormProcessLinkActivityHandler(bundleUrlResolver)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginTaskFormSubmissionService::class)
    fun externalPluginTaskFormSubmissionService(
        processLinkService: com.ritense.processlink.service.ProcessLinkService,
        configurationService: ExternalPluginConfigurationService,
        definitionService: ExternalPluginDefinitionService,
        hostService: ExternalPluginHostService,
        hostClient: ExternalPluginHostClient,
        processDocumentService: com.ritense.processdocument.service.ProcessDocumentService,
        documentService: com.ritense.document.service.impl.JsonSchemaDocumentService,
        operatonTaskService: com.ritense.valtimo.service.OperatonTaskService,
        authorizationService: com.ritense.authorization.AuthorizationService,
        valueResolverService: ValueResolverService,
        objectMapper: ObjectMapper,
    ) = ExternalPluginTaskFormSubmissionService(
        processLinkService,
        configurationService,
        definitionService,
        hostService,
        hostClient,
        processDocumentService,
        documentService,
        operatonTaskService,
        authorizationService,
        valueResolverService,
        objectMapper,
    )

    @Bean
    @ConditionalOnMissingBean(ExternalPluginTaskFormSubmissionResource::class)
    fun externalPluginTaskFormSubmissionResource(
        submissionService: ExternalPluginTaskFormSubmissionService,
    ) = ExternalPluginTaskFormSubmissionResource(submissionService)

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
        pluginActionResultHandler: PluginActionResultHandler,
        buildingBlockPluginConfigurationResolver: BuildingBlockPluginConfigurationResolver?,
    ) = ExternalPluginServiceTaskStartListener(
        processLinkRepository,
        configurationService,
        definitionService,
        hostService,
        hostClient,
        valueResolverService,
        objectMapper,
        pluginActionResultHandler,
        buildingBlockPluginConfigurationResolver,
    )

    @Bean
    @Order(430)
    @ConditionalOnMissingBean(ExternalPluginHttpSecurityConfigurer::class)
    fun externalPluginHttpSecurityConfigurer() = ExternalPluginHttpSecurityConfigurer()

    @Bean
    @ConditionalOnMissingBean(ExternalPluginImportPreviewContributor::class)
    fun externalPluginImportPreviewContributor(
        objectMapper: ObjectMapper,
        configurationRepository: ExternalPluginConfigurationRepository,
        definitionRepository: ExternalPluginDefinitionRepository,
    ): ImportPreviewContributor =
        ExternalPluginImportPreviewContributor(objectMapper, configurationRepository, definitionRepository)

    @Bean
    @ConditionalOnMissingBean(ExternalPluginConfigurationMappingResolver::class)
    fun externalPluginConfigurationMappingResolver(
        processLinkRepository: ExternalPluginProcessLinkRepository,
        taskFormProcessLinkRepository: ExternalPluginTaskFormProcessLinkRepository,
        configurationRepository: ExternalPluginConfigurationRepository,
        caseExternalPluginTabRepository: CaseExternalPluginTabRepository,
        caseTabRepository: CaseTabRepository,
        caseExternalPluginWidgetService: com.ritense.case_.service.CaseExternalPluginWidgetService,
        processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
        caseDefinitionChecker: CaseDefinitionChecker,
        applicationEventPublisher: ApplicationEventPublisher,
    ): PluginConfigurationMappingResolver = ExternalPluginConfigurationMappingResolver(
        processLinkRepository,
        taskFormProcessLinkRepository,
        configurationRepository,
        caseExternalPluginTabRepository,
        caseTabRepository,
        caseExternalPluginWidgetService,
        processDefinitionCaseDefinitionService,
        caseDefinitionChecker,
        applicationEventPublisher,
    )
}
