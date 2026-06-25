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

package com.ritense.zakenapi.config

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.case_.listener.ZaakTypeLinkCaseEventListener
import com.ritense.catalogiapi.service.CatalogiService
import com.ritense.catalogiapi.service.ZaaktypeUrlProvider
import com.ritense.document.service.DocumentService
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.documentenapi.service.DocumentenApiService
import com.ritense.documentenapi.service.DocumentenApiVersionService
import com.ritense.formflow.expression.FormFlowBean
import com.ritense.outbox.OutboxService
import com.ritense.plugin.repository.PluginConfigurationRepository
import com.ritense.plugin.service.PluginService
import com.ritense.processdocument.importer.ZaakTypeLinkImporter
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.resource.service.TemporaryResourceStorageService
import com.ritense.temporaryresource.repository.ResourceStorageMetadataRepository
import com.ritense.valtimo.contract.annotation.ProcessBean
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valueresolver.ValueResolverService
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPluginFactory
import com.ritense.zakenapi.client.ZakenApiClient
import com.ritense.zakenapi.exporter.ZaakTypeLinkExporter
import com.ritense.zakenapi.formflow.ZakenFormFlow
import com.ritense.zakenapi.ikorepository.ZakenApiIkoRepository
import com.ritense.zakenapi.link.ZaakInstanceLinkService
import com.ritense.zakenapi.listener.DocumentMetadataAvailableEventListener
import com.ritense.zakenapi.listener.ZaakNotitieEventListener
import com.ritense.zakenapi.listener.ZaakTypeLinkConfigurationIssueListener
import com.ritense.zakenapi.listener.ZakenApiCaseAssigneeListener
import com.ritense.zakenapi.listener.ZakenApiDocumentDeletedEventListener
import com.ritense.zakenapi.listener.ZakenApiEventListener
import com.ritense.zakenapi.provider.BsnProvider
import com.ritense.zakenapi.provider.DefaultZaakUrlProvider
import com.ritense.zakenapi.provider.DefaultZaaktypeUrlProvider
import com.ritense.zakenapi.provider.KvkProvider
import com.ritense.zakenapi.provider.ZaakBsnProvider
import com.ritense.zakenapi.provider.ZaakKvkProvider
import com.ritense.zakenapi.repository.ZaakHersteltermijnRepository
import com.ritense.zakenapi.repository.ZaakInstanceLinkRepository
import com.ritense.zakenapi.repository.ZaakNotitieLinkRepository
import com.ritense.zakenapi.repository.ZaakTypeLinkRepository
import com.ritense.zakenapi.resolver.ZaakResultaatValueResolverFactory
import com.ritense.zakenapi.resolver.ZaakStatusValueResolverFactory
import com.ritense.zakenapi.resolver.ZaakValueResolverFactory
import com.ritense.zakenapi.security.ZaakActionProvider
import com.ritense.zakenapi.security.ZaakSpecificationFactory
import com.ritense.zakenapi.security.ZakenApiHttpSecurityConfigurer
import com.ritense.zakenapi.service.DefaultZaakTypeLinkService
import com.ritense.zakenapi.service.UploadProcessDelegate
import com.ritense.zakenapi.service.ZaakDocumentService
import com.ritense.zakenapi.service.ZaakNotitieService
import com.ritense.zakenapi.service.ZaakService
import com.ritense.zakenapi.service.ZaakTypeLinkService
import com.ritense.zakenapi.service.ZakenDocumentDeleteHandler
import com.ritense.zakenapi.sync.CaseZakenApiSyncCaseEventListener
import com.ritense.zakenapi.sync.CaseZakenApiSyncExporter
import com.ritense.zakenapi.sync.CaseZakenApiSyncImporter
import com.ritense.zakenapi.sync.CaseZakenApiSyncManagementResource
import com.ritense.zakenapi.sync.CaseZakenApiSyncManagementService
import com.ritense.zakenapi.sync.CaseZakenApiSyncRepository
import com.ritense.zakenapi.web.rest.CaseZgwInspectionResource
import com.ritense.zakenapi.web.rest.DefaultZaakTypeLinkResource
import com.ritense.zakenapi.web.rest.ZaakDocumentResource
import com.ritense.zakenapi.widget.ZaakMetrolineDataServiceImpl
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.web.client.RestClient
import kotlin.contracts.ExperimentalContracts

@AutoConfiguration
@EnableJpaRepositories(basePackages = ["com.ritense.zakenapi.repository", "com.ritense.zakenapi.sync"])
@EntityScan(basePackages = ["com.ritense.zakenapi.domain", "com.ritense.zakenapi.sync"])
class ZakenApiAutoConfiguration {

    @Bean
    fun zakenApiClient(
        restClientBuilder: RestClient.Builder,
        outboxService: OutboxService,
        objectMapper: ObjectMapper,
        authorizationService: AuthorizationService,
        @Value("\${valtimo.authorization.zgwDocuments.enabled:false}")
        authorizationEnabled: Boolean,
        applicationEventPublisher: ApplicationEventPublisher
    ) = ZakenApiClient(
        restClientBuilder,
        outboxService,
        objectMapper,
        authorizationService,
        authorizationEnabled,
        applicationEventPublisher = applicationEventPublisher
    )

    @Bean
    fun zakenApiPluginFactory(
        pluginService: PluginService,
        zakenApiClient: ZakenApiClient,
        zaakUrlProvider: ZaakUrlProvider,
        storageService: TemporaryResourceStorageService,
        zaakInstanceLinkRepository: ZaakInstanceLinkRepository,
        zaakHersteltermijnRepository: ZaakHersteltermijnRepository,
        zaakDocumentService: ZaakDocumentService,
        platformTransactionManager: PlatformTransactionManager,
        valueResolverService: ValueResolverService,
        objectMapper: ObjectMapper,
        zaakNotitieLinkRepository: ZaakNotitieLinkRepository,
        caseDocumentResolver: CaseDocumentResolver,
        userManagementService: UserManagementService,
    ) = ZakenApiPluginFactory(
        pluginService,
        zakenApiClient,
        zaakUrlProvider,
        storageService,
        zaakInstanceLinkRepository,
        zaakHersteltermijnRepository,
        zaakDocumentService,
        platformTransactionManager,
        valueResolverService,
        objectMapper,
        zaakNotitieLinkRepository,
        caseDocumentResolver,
        userManagementService,
    )

    @Bean
    fun zakenApiZaakInstanceLinkService(
        zaakInstanceLinkRepository: ZaakInstanceLinkRepository
    ) = ZaakInstanceLinkService(
        zaakInstanceLinkRepository
    )

    @Bean
    fun zaakDocumentService(
        zaakUrlProvider: ZaakUrlProvider,
        pluginService: PluginService,
        catalogiService: CatalogiService,
        documentenApiService: DocumentenApiService,
        documentenApiVersionService: DocumentenApiVersionService,
        authorizationService: AuthorizationService,
    ) = ZaakDocumentService(
        zaakUrlProvider,
        pluginService,
        catalogiService,
        documentenApiService,
        documentenApiVersionService,
        authorizationService
    )

    @Bean
    @ConditionalOnMissingBean(ZaakDocumentResource::class)
    fun zaakDocumentResource(
        zaakDocumentService: ZaakDocumentService
    ) = ZaakDocumentResource(
        zaakDocumentService
    )

    @Bean
    @ConditionalOnMissingBean(CaseZgwInspectionResource::class)
    fun caseZgwInspectionResource(
        documentService: DocumentService,
        authorizationService: AuthorizationService,
        zaakInstanceLinkService: ZaakInstanceLinkService,
        pluginService: PluginService,
        objectMapper: ObjectMapper,
    ) = CaseZgwInspectionResource(
        documentService,
        authorizationService,
        zaakInstanceLinkService,
        pluginService,
        objectMapper,
    )

    @Bean
    @ConditionalOnMissingBean(ZaakValueResolverFactory::class)
    fun zaakValueResolverFactory(
        zaakDocumentService: ZaakDocumentService,
        processDocumentService: ProcessDocumentService
    ) = ZaakValueResolverFactory(
        zaakDocumentService,
        processDocumentService
    )

    @Bean
    @ConditionalOnMissingBean(ZaakStatusValueResolverFactory::class)
    fun zaakStatusValueResolverFactory(
        processDocumentService: ProcessDocumentService,
        zaakUrlProvider: ZaakUrlProvider,
        pluginService: PluginService,
    ) = ZaakStatusValueResolverFactory(
        processDocumentService,
        zaakUrlProvider,
        pluginService
    )

    @Bean
    @ConditionalOnMissingBean(ZaakResultaatValueResolverFactory::class)
    fun zaakResultaatValueResolverFactory(
        processDocumentService: ProcessDocumentService,
        zaakUrlProvider: ZaakUrlProvider,
        pluginService: PluginService,
    ) = ZaakResultaatValueResolverFactory(
        processDocumentService,
        zaakUrlProvider,
        pluginService
    )

    @OptIn(ExperimentalContracts::class)
    @Bean
    @ConditionalOnMissingBean(BsnProvider::class)
    fun bsnProvider(
        processDocumentService: ProcessDocumentService,
        zaakInstanceLinkService: ZaakInstanceLinkService,
        pluginService: PluginService
    ) = ZaakBsnProvider(
        processDocumentService,
        zaakInstanceLinkService,
        pluginService
    )

    @OptIn(ExperimentalContracts::class)
    @Bean
    @ConditionalOnMissingBean(KvkProvider::class)
    fun kvkProvider(
        processDocumentService: ProcessDocumentService,
        zaakInstanceLinkService: ZaakInstanceLinkService,
        pluginService: PluginService
    ) = ZaakKvkProvider(
        processDocumentService,
        zaakInstanceLinkService,
        pluginService
    )

    @Order(300)
    @Bean
    fun zakenApiHttpSecurityConfigurer() = ZakenApiHttpSecurityConfigurer()

    @Bean
    fun zakenApiZaakTypeLinkService(
        zaakTypeLinkRepository: ZaakTypeLinkRepository,
        processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
        caseDefinitionChecker: CaseDefinitionChecker,
        applicationEventPublisher: ApplicationEventPublisher,
    ) = DefaultZaakTypeLinkService(
        zaakTypeLinkRepository,
        processDefinitionCaseDefinitionService,
        caseDefinitionChecker,
        applicationEventPublisher
    )

    @Bean
    fun zakenApiEventListener(
        pluginService: PluginService,
        zaakTypeLinkService: ZaakTypeLinkService
    ) = ZakenApiEventListener(
        pluginService,
        zaakTypeLinkService
    )

    @Bean
    fun zakenApiZaakTypeLinkResource(
        zaakTypeLinkService: ZaakTypeLinkService
    ) = DefaultZaakTypeLinkResource(
        zaakTypeLinkService
    )

    @Bean
    fun zakenDocumentDeleteHandler(
        pluginService: PluginService
    ) = ZakenDocumentDeleteHandler(
        pluginService
    )

    @Bean
    @ConditionalOnMissingBean(DocumentMetadataAvailableEventListener::class)
    fun documentMetadataAvailableEventListener(
        resourceStorageMetadataRepository: ResourceStorageMetadataRepository,
    ) = DocumentMetadataAvailableEventListener(resourceStorageMetadataRepository)

    @Bean
    @ProcessBean
    @ConditionalOnMissingBean(UploadProcessDelegate::class)
    fun uploadProcessDelegate(
        applicationEventPublisher: ApplicationEventPublisher
    ): UploadProcessDelegate = UploadProcessDelegate(applicationEventPublisher)

    @Bean
    @Primary
    @ConditionalOnMissingBean(ZaakUrlProvider::class)
    fun zaakUrlProvider(
        zaakInstanceLinkService: ZaakInstanceLinkService,
        caseDocumentResolver: CaseDocumentResolver
    ) = DefaultZaakUrlProvider(
        zaakInstanceLinkService,
        caseDocumentResolver
    )

    @Bean
    @Primary
    @ConditionalOnMissingBean(ZaaktypeUrlProvider::class)
    fun zaaktypeUrlProvider(
        zaakTypeLinkService: ZaakTypeLinkService,
        caseDocumentResolver: CaseDocumentResolver,
        jsonSchemaDocumentService: JsonSchemaDocumentService,
    ) = DefaultZaaktypeUrlProvider(
        zaakTypeLinkService,
        caseDocumentResolver,
        jsonSchemaDocumentService
    )

    @Bean
    @ConditionalOnMissingBean(ZakenApiDocumentDeletedEventListener::class)
    @Order(200)
    fun zakenApiDocumentDeletedEventListener(
        zaakInstanceService: ZaakInstanceLinkService,
        zaakDocumentService: ZaakDocumentService,
        pluginService: PluginService
    ) = ZakenApiDocumentDeletedEventListener(
        zaakInstanceService,
        zaakDocumentService,
        pluginService
    )

    @Bean
    @ConditionalOnMissingBean(ZaakTypeLinkImporter::class)
    fun zaakTypeLinkImporter(
        objectMapper: ObjectMapper,
        zaakTypeLinkService: ZaakTypeLinkService,
        applicationEventPublisher: ApplicationEventPublisher,
        pluginConfigurationRepository: PluginConfigurationRepository
    ) = ZaakTypeLinkImporter(
        objectMapper,
        zaakTypeLinkService,
        applicationEventPublisher,
        pluginConfigurationRepository
    )

    @Bean
    @ConditionalOnMissingBean(ZaakTypeLinkExporter::class)
    fun zaakTypeLinkExporter(
        objectMapper: ObjectMapper,
        zaakTypeLinkService: ZaakTypeLinkService
    ) = ZaakTypeLinkExporter(
        objectMapper,
        zaakTypeLinkService
    )

    @Bean
    @ConditionalOnMissingBean(ZaakTypeLinkCaseEventListener::class)
    fun zaakTypeLinkCaseEventListener(
        zaakTypeLinkService: ZaakTypeLinkService,
    ): ZaakTypeLinkCaseEventListener {
        return ZaakTypeLinkCaseEventListener(
            zaakTypeLinkService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(ZakenApiIkoRepository::class)
    fun zakenApiIkoRepository(
        pluginService: PluginService,
        objectMapper: ObjectMapper,
    ) = ZakenApiIkoRepository(
        pluginService,
        objectMapper,
    )

    @Bean
    @ConditionalOnMissingBean(ZaakNotitieService::class)
    fun zaakNotitieService(
        zaakUrlProvider: ZaakUrlProvider,
        pluginService: PluginService,
        zaakNotitieLinkRepository: ZaakNotitieLinkRepository
    ) = ZaakNotitieService(
        zaakUrlProvider,
        pluginService,
        zaakNotitieLinkRepository
    )

    @Bean
    @ConditionalOnMissingBean(ZaakNotitieEventListener::class)
    fun zaakNotitieEventListener(
        zaakNotitieService: ZaakNotitieService,
        caseZakenApiSyncManagementService: CaseZakenApiSyncManagementService,
        documentService: DocumentService,
        caseDocumentResolver: CaseDocumentResolver,
    ) = ZaakNotitieEventListener(
        zaakNotitieService,
        caseZakenApiSyncManagementService,
        documentService,
        caseDocumentResolver,
    )

    @Bean
    @ConditionalOnMissingBean(ZaakSpecificationFactory::class)
    fun zaakSpecificationFactory(): ZaakSpecificationFactory {
        return ZaakSpecificationFactory()
    }

    @Bean
    @ConditionalOnMissingBean(ZaakActionProvider::class)
    fun zaakActionProvider(): ZaakActionProvider {
        return ZaakActionProvider()
    }

    @Bean
    @ConditionalOnMissingBean(ZaakService::class)
    fun zaakService(
        pluginService: PluginService,
        authorizationService: AuthorizationService,
    ): ZaakService {
        return ZaakService(pluginService, authorizationService)
    }

    @Bean
    @ConditionalOnMissingBean(ZaakTypeLinkConfigurationIssueListener::class)
    fun zaakTypeLinkConfigurationIssueListener(
        applicationEventPublisher: ApplicationEventPublisher
    ) = ZaakTypeLinkConfigurationIssueListener(applicationEventPublisher)

    @Bean
    @ConditionalOnMissingBean(ZaakMetrolineDataServiceImpl::class)
    fun zaakMetrolineDataService(
        zaakUrlProvider: ZaakUrlProvider,
        pluginService: PluginService,
    ) = ZaakMetrolineDataServiceImpl(
        zaakUrlProvider,
        pluginService,
    )

    @Bean
    @ConditionalOnMissingBean(CaseZakenApiSyncManagementService::class)
    fun caseZakenApiSyncManagementService(
        caseZakenApiSyncRepository: CaseZakenApiSyncRepository,
        caseDefinitionChecker: CaseDefinitionChecker,
        applicationEventPublisher: ApplicationEventPublisher,
    ) = CaseZakenApiSyncManagementService(
        caseZakenApiSyncRepository,
        caseDefinitionChecker,
        applicationEventPublisher,
    )

    @Bean
    @ConditionalOnMissingBean(CaseZakenApiSyncManagementResource::class)
    fun caseZakenApiSyncManagementResource(
        caseZakenApiSyncManagementService: CaseZakenApiSyncManagementService,
    ) = CaseZakenApiSyncManagementResource(
        caseZakenApiSyncManagementService,
    )

    @Bean
    @ConditionalOnMissingBean(CaseZakenApiSyncCaseEventListener::class)
    fun caseZakenApiSyncCaseEventListener(
        caseZakenApiSyncManagementService: CaseZakenApiSyncManagementService,
    ) = CaseZakenApiSyncCaseEventListener(
        caseZakenApiSyncManagementService,
    )

    @Bean
    @ConditionalOnMissingBean(CaseZakenApiSyncImporter::class)
    fun caseZakenApiSyncImporter(
        objectMapper: ObjectMapper,
        caseZakenApiSyncRepository: CaseZakenApiSyncRepository,
        catalogiService: CatalogiService,
        applicationEventPublisher: ApplicationEventPublisher,
    ) = CaseZakenApiSyncImporter(
        objectMapper,
        caseZakenApiSyncRepository,
        catalogiService,
        applicationEventPublisher,
    )

    @Bean
    @ConditionalOnMissingBean(CaseZakenApiSyncExporter::class)
    fun caseZakenApiSyncExporter(
        objectMapper: ObjectMapper,
        caseZakenApiSyncRepository: CaseZakenApiSyncRepository,
    ) = CaseZakenApiSyncExporter(
        objectMapper,
        caseZakenApiSyncRepository,
    )

    @Bean
    @ConditionalOnMissingBean(ZakenApiCaseAssigneeListener::class)
    fun zakenApiCaseAssigneeListener(
        zaakInstanceLinkService: ZaakInstanceLinkService,
        pluginService: PluginService,
        caseZakenApiSyncManagementService: CaseZakenApiSyncManagementService,
        documentService: DocumentService,
        caseDocumentResolver: CaseDocumentResolver,
    ) = ZakenApiCaseAssigneeListener(
        zaakInstanceLinkService,
        pluginService,
        caseZakenApiSyncManagementService,
        documentService,
        caseDocumentResolver,
    )

    @Bean
    @ConditionalOnClass(FormFlowBean::class) // Only registered when :form-flow is on the classpath
    @ConditionalOnMissingBean(ZakenFormFlow::class)
    fun zakenFormFlow(zaakService: ZaakService): ZakenFormFlow = ZakenFormFlow(zaakService)
}
