/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.iko.autoconfigure

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.case_.service.CaseWidgetService
import com.ritense.exporter.ExportService
import com.ritense.iko.IkoServerRepository
import com.ritense.iko.IkoValueResolverFactory
import com.ritense.iko.authorization.IkoViewSpecificationFactory
import com.ritense.iko.client.IkoClient
import com.ritense.iko.event.IkoRepositoryConfigEventListener
import com.ritense.iko.event.IkoSearchActionEventListener
import com.ritense.iko.event.IkoViewEventListener
import com.ritense.iko.event.IkoViewTabEventListener
import com.ritense.iko.exporter.IkoListColumnsExporter
import com.ritense.iko.exporter.IkoSearchActionsExporter
import com.ritense.iko.exporter.IkoSearchFieldsExporter
import com.ritense.iko.exporter.IkoTabsExporter
import com.ritense.iko.exporter.IkoViewExporter
import com.ritense.iko.exporter.IkoWidgetsExporter
import com.ritense.iko.importer.IkoListColumnImporter
import com.ritense.iko.importer.IkoRepositoryConfigImporter
import com.ritense.iko.importer.IkoSearchActionImporter
import com.ritense.iko.importer.IkoSearchFieldImporter
import com.ritense.iko.importer.IkoTabImporter
import com.ritense.iko.importer.IkoViewImporter
import com.ritense.iko.importer.IkoWidgetImporter
import com.ritense.iko.repository.IkoRepositoryConfigRepository
import com.ritense.iko.repository.IkoSearchActionRepository
import com.ritense.iko.repository.IkoSearchActionSearchFieldRepository
import com.ritense.iko.repository.IkoTabWidgetRepository
import com.ritense.iko.repository.IkoViewListColumnRepository
import com.ritense.iko.repository.IkoViewRepository
import com.ritense.iko.repository.IkoViewTabRepository
import com.ritense.iko.security.config.IkoHttpSecurityConfigurer
import com.ritense.iko.service.IkoListColumnService
import com.ritense.iko.service.IkoRepositoryService
import com.ritense.iko.service.IkoSearchActionService
import com.ritense.iko.service.IkoSearchFieldService
import com.ritense.iko.service.IkoTabService
import com.ritense.iko.service.IkoViewService
import com.ritense.iko.service.IkoWidgetService
import com.ritense.iko.web.rest.IkoListColumnManagementResource
import com.ritense.iko.web.rest.IkoRepositoryManagementResource
import com.ritense.iko.web.rest.IkoSearchActionManagementResource
import com.ritense.iko.web.rest.IkoSearchActionResource
import com.ritense.iko.web.rest.IkoSearchFieldManagementResource
import com.ritense.iko.web.rest.IkoTabManagementResource
import com.ritense.iko.web.rest.IkoTabResource
import com.ritense.iko.web.rest.IkoViewManagementResource
import com.ritense.iko.web.rest.IkoViewResource
import com.ritense.iko.web.rest.IkoWidgetManagementResource
import com.ritense.iko.web.rest.IkoWidgetResource
import com.ritense.importer.ImportService
import com.ritense.search.service.SearchFieldV2Service
import com.ritense.search.service.SearchListColumnService
import com.ritense.tab.service.TabService
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.valtimo.contract.iko.IkoRepository
import com.ritense.widget.service.WidgetService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.web.client.RestClient

@AutoConfiguration
@EnableJpaRepositories(basePackages = ["com.ritense.iko.repository"])
@EntityScan("com.ritense.iko.domain")
class IkoAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(IkoRepositoryService::class)
    fun ikoRepositoryService(
        ikoRepositoryConfigRepository: IkoRepositoryConfigRepository,
        authorizationService: AuthorizationService,
        ikoRepositories: List<IkoRepository>,
        applicationEventPublisher: ApplicationEventPublisher,
    ) = IkoRepositoryService(
        ikoRepositoryConfigRepository,
        authorizationService,
        ikoRepositories,
        applicationEventPublisher,
    )

    @Bean
    @ConditionalOnMissingBean(IkoViewService::class)
    fun ikoViewService(
        ikoViewRepository: IkoViewRepository,
        ikoRepositoryService: IkoRepositoryService,
        authorizationService: AuthorizationService,
        ikoRepositories: List<IkoRepository>,
        applicationEventPublisher: ApplicationEventPublisher,
    ) = IkoViewService(
        ikoViewRepository,
        ikoRepositoryService,
        authorizationService,
        ikoRepositories,
        applicationEventPublisher,
    )

    @Bean
    @ConditionalOnMissingBean(IkoSearchActionService::class)
    fun ikoSearchActionService(
        ikoSearchActionRepository: IkoSearchActionRepository,
        ikoViewService: IkoViewService,
        ikoRepositories: List<IkoRepository>,
        applicationEventPublisher: ApplicationEventPublisher,
    ) = IkoSearchActionService(
        ikoSearchActionRepository,
        ikoViewService,
        ikoRepositories,
        applicationEventPublisher,
    )

    @Order(300)
    @Bean
    @ConditionalOnMissingBean(IkoHttpSecurityConfigurer::class)
    fun ikoHttpSecurityConfigurer(): IkoHttpSecurityConfigurer {
        return IkoHttpSecurityConfigurer()
    }

    @Bean
    @ConditionalOnMissingBean(IkoViewSpecificationFactory::class)
    fun ikoViewSpecificationFactory(
        ikoViewRepository: IkoViewRepository,
        queryDialectHelper: QueryDialectHelper,
    ): IkoViewSpecificationFactory {
        return IkoViewSpecificationFactory(
            ikoViewRepository,
            queryDialectHelper,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoViewResource::class)
    fun ikoViewResource(
        service: IkoViewService,
    ): IkoViewResource {
        return IkoViewResource(
            service,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoRepositoryManagementResource::class)
    fun ikoRepositoryManagementResource(
        service: IkoRepositoryService,
    ): IkoRepositoryManagementResource {
        return IkoRepositoryManagementResource(
            service,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoViewManagementResource::class)
    fun ikoViewManagementResource(
        service: IkoViewService,
        exportService: ExportService,
        importService: ImportService,
    ): IkoViewManagementResource {
        return IkoViewManagementResource(
            service,
            exportService,
            importService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoSearchActionManagementResource::class)
    fun ikoSearchActionManagementResource(
        service: IkoSearchActionService,
        ikoViewService: IkoViewService,
    ): IkoSearchActionManagementResource {
        return IkoSearchActionManagementResource(
            service,
            ikoViewService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoSearchActionResource::class)
    fun ikoSearchActionResource(
        ikoSearchActionService: IkoSearchActionService,
        listColumnService: IkoListColumnService,
        searchFieldService: IkoSearchFieldService,
    ): IkoSearchActionResource {
        return IkoSearchActionResource(
            ikoSearchActionService,
            listColumnService,
            searchFieldService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoWidgetResource::class)
    fun ikoWidgetResource(
        ikoWidgetService: IkoWidgetService,
    ): IkoWidgetResource {
        return IkoWidgetResource(
            ikoWidgetService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoTabResource::class)
    fun ikoTabResource(
        ikoTabService: IkoTabService,
    ): IkoTabResource {
        return IkoTabResource(
            ikoTabService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoTabManagementResource::class)
    fun ikoTabManagementResource(
        ikoTabService: IkoTabService,
    ): IkoTabManagementResource {
        return IkoTabManagementResource(
            ikoTabService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoWidgetManagementResource::class)
    fun ikoWidgetManagementResource(
        ikoWidgetService: IkoWidgetService,
    ): IkoWidgetManagementResource {
        return IkoWidgetManagementResource(
            ikoWidgetService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoListColumnManagementResource::class)
    fun ikoListColumnManagementResource(
        ikoListColumnService: IkoListColumnService,
    ): IkoListColumnManagementResource {
        return IkoListColumnManagementResource(
            ikoListColumnService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoSearchFieldManagementResource::class)
    fun ikoSearchFieldManagementResource(
        ikoSearchFieldService: IkoSearchFieldService,
    ): IkoSearchFieldManagementResource {
        return IkoSearchFieldManagementResource(
            ikoSearchFieldService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoClient::class)
    fun ikoClient(
        restClientBuilder: RestClient.Builder,
        objectMapper: ObjectMapper,
    ): IkoClient {
        return IkoClient(
            restClientBuilder,
            objectMapper,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoValueResolverFactory::class)
    fun ikoValueResolverFactory(
        ikoTabService: IkoTabService,
        objectMapper: ObjectMapper,
        ikoWidgetService: IkoWidgetService,
        caseWidgetService: CaseWidgetService,
        ikoServerRepository: IkoServerRepository,
        ikoRepositoryConfigRepository: IkoRepositoryConfigRepository,
    ): IkoValueResolverFactory {
        return IkoValueResolverFactory(
            ikoTabService,
            objectMapper,
            ikoWidgetService,
            caseWidgetService,
            ikoServerRepository,
            ikoRepositoryConfigRepository,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoServerRepository::class)
    fun ikoServerRepository(
        ikoClient: IkoClient,
    ): IkoServerRepository {
        return IkoServerRepository(
            ikoClient,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoRepositoryConfigImporter::class)
    fun ikoRepositoryConfigImporter(
        objectMapper: ObjectMapper,
        ikoRepositoryService: IkoRepositoryService,
    ): IkoRepositoryConfigImporter {
        return IkoRepositoryConfigImporter(
            objectMapper,
            ikoRepositoryService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoViewImporter::class)
    fun ikoViewImporter(
        objectMapper: ObjectMapper,
        ikoViewService: IkoViewService,
    ): IkoViewImporter {
        return IkoViewImporter(
            objectMapper,
            ikoViewService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoSearchActionImporter::class)
    fun ikoSearchActionImporter(
        objectMapper: ObjectMapper,
        ikoSearchActionService: IkoSearchActionService,
        ikoViewService: IkoViewService,
    ): IkoSearchActionImporter {
        return IkoSearchActionImporter(
            objectMapper,
            ikoSearchActionService,
            ikoViewService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoSearchFieldImporter::class)
    fun ikoSearchFieldImporter(
        objectMapper: ObjectMapper,
        searchFieldService: IkoSearchFieldService,
    ): IkoSearchFieldImporter {
        return IkoSearchFieldImporter(
            objectMapper,
            searchFieldService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoListColumnImporter::class)
    fun ikoListColumnImporter(
        objectMapper: ObjectMapper,
        listColumnService: IkoListColumnService,
    ): IkoListColumnImporter {
        return IkoListColumnImporter(
            objectMapper,
            listColumnService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoTabImporter::class)
    fun ikoTabImporter(
        objectMapper: ObjectMapper,
        ikoTabService: IkoTabService,
    ): IkoTabImporter {
        return IkoTabImporter(
            objectMapper,
            ikoTabService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoWidgetImporter::class)
    fun ikoWidgetImporter(
        objectMapper: ObjectMapper,
        ikoWidgetService: IkoWidgetService,
    ): IkoWidgetImporter {
        return IkoWidgetImporter(
            objectMapper,
            ikoWidgetService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoViewExporter::class)
    fun ikoViewExporter(
        objectMapper: ObjectMapper,
        ikoViewService: IkoViewService,
    ): IkoViewExporter {
        return IkoViewExporter(
            objectMapper,
            ikoViewService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoSearchActionsExporter::class)
    fun ikoSearchActionExporter(
        objectMapper: ObjectMapper,
        ikoSearchActionService: IkoSearchActionService,
    ): IkoSearchActionsExporter {
        return IkoSearchActionsExporter(
            objectMapper,
            ikoSearchActionService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoListColumnsExporter::class)
    fun ikoListColumnsExporter(
        objectMapper: ObjectMapper,
        ikoListColumnService: IkoListColumnService,
    ): IkoListColumnsExporter {
        return IkoListColumnsExporter(
            objectMapper,
            ikoListColumnService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoSearchFieldsExporter::class)
    fun ikoSearchFieldsExporter(
        objectMapper: ObjectMapper,
        ikoSearchFieldService: IkoSearchFieldService,
    ): IkoSearchFieldsExporter {
        return IkoSearchFieldsExporter(
            objectMapper,
            ikoSearchFieldService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoTabsExporter::class)
    fun ikoTabsExporter(
        objectMapper: ObjectMapper,
        ikoTabService: IkoTabService,
    ): IkoTabsExporter {
        return IkoTabsExporter(
            objectMapper,
            ikoTabService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoWidgetsExporter::class)
    fun ikoWidgetsExporter(
        objectMapper: ObjectMapper,
        ikoWidgetService: IkoWidgetService,
    ): IkoWidgetsExporter {
        return IkoWidgetsExporter(
            objectMapper,
            ikoWidgetService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoWidgetService::class)
    fun ikoWidgetService(
        ikoTabService: IkoTabService,
        ikoTabWidgetRepository: IkoTabWidgetRepository,
        widgetService: WidgetService,
        ikoViewService: IkoViewService,
    ): IkoWidgetService {
        return IkoWidgetService(
            ikoTabService,
            ikoTabWidgetRepository,
            widgetService,
            ikoViewService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoTabService::class)
    fun ikoTabService(
        tabService: TabService,
        ikoViewTabRepository: IkoViewTabRepository,
        ikoViewService: IkoViewService,
        applicationEventPublisher: ApplicationEventPublisher,
        ikoRepositories: List<IkoRepository>,
    ): IkoTabService {
        return IkoTabService(
            tabService,
            ikoViewTabRepository,
            ikoViewService,
            applicationEventPublisher,
            ikoRepositories,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoListColumnService::class)
    fun ikoListColumnService(
        listColumnService: SearchListColumnService,
        ikoViewListColumnRepository: IkoViewListColumnRepository,
        ikoViewService: IkoViewService,
    ): IkoListColumnService {
        return IkoListColumnService(
            listColumnService,
            ikoViewListColumnRepository,
            ikoViewService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoSearchFieldService::class)
    fun ikoSearchFieldService(
        searchFieldService: SearchFieldV2Service,
        ikoSearchActionSearchFieldRepository: IkoSearchActionSearchFieldRepository,
        ikoViewService: IkoViewService,
    ): IkoSearchFieldService {
        return IkoSearchFieldService(
            searchFieldService,
            ikoSearchActionSearchFieldRepository,
            ikoViewService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoRepositoryConfigEventListener::class)
    fun ikoRepositoryConfigEventListener(
        ikoViewService: IkoViewService,
    ): IkoRepositoryConfigEventListener {
        return IkoRepositoryConfigEventListener(
            ikoViewService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoViewEventListener::class)
    fun ikoViewEventListener(
        ikoSearchActionService: IkoSearchActionService,
        ikoListColumnService: IkoListColumnService,
        ikoTabService: IkoTabService,
    ): IkoViewEventListener {
        return IkoViewEventListener(
            ikoSearchActionService,
            ikoListColumnService,
            ikoTabService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoSearchActionEventListener::class)
    fun ikoSearchActionEventListener(
        ikoSearchFieldService: IkoSearchFieldService,
    ): IkoSearchActionEventListener {
        return IkoSearchActionEventListener(
            ikoSearchFieldService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(IkoViewTabEventListener::class)
    fun ikoViewTabEventListener(
        ikoWidgetService: IkoWidgetService,
    ): IkoViewTabEventListener {
        return IkoViewTabEventListener(
            ikoWidgetService,
        )
    }

}
