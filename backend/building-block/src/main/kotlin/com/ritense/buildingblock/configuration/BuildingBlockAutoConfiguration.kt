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

package com.ritense.buildingblock.configuration

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.buildingblock.processlink.mapper.BuildingBlockProcessLinkMapper
import com.ritense.buildingblock.processlink.service.BuildingBlockCallActivityListener
import com.ritense.buildingblock.processlink.service.BuildingBlockSupportedProcessLinksHandler
import com.ritense.buildingblock.processlink.service.DefaultBuildingBlockPluginConfigurationResolver
import com.ritense.buildingblock.repository.BuildingBlockDefinitionArtworkRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.security.config.BuildingBlockHttpSecurityConfigurer
import com.ritense.buildingblock.service.BuildingBlockDefinitionArtworkImporter
import com.ritense.buildingblock.service.BuildingBlockDefinitionArtworkService
import com.ritense.buildingblock.service.BuildingBlockDefinitionCheckerImpl
import com.ritense.buildingblock.service.BuildingBlockDefinitionDeploymentService
import com.ritense.buildingblock.service.BuildingBlockDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockDefinitionMainProcessDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockDefinitionProcessDefinitionService
import com.ritense.buildingblock.service.BuildingBlockDocumentDefinitionService
import com.ritense.buildingblock.service.BuildingBlockJsonSchemaDocumentDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.service.BuildingBlockPluginDefinitionService
import com.ritense.buildingblock.service.ProcessDefinitionBuildingBlockDefinitionImporter
import com.ritense.buildingblock.web.rest.BuildingBlockDefinitionArtworkResource
import com.ritense.buildingblock.web.rest.BuildingBlockDocumentDefinitionResource
import com.ritense.buildingblock.web.rest.BuildingBlockManagementResource
import com.ritense.buildingblock.web.rest.BuildingBlockProcessResource
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.importer.ImportService
import com.ritense.importer.ValtimoImportService
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.config.LiquibaseMasterChangeLogLocation
import com.ritense.valtimo.service.OperatonProcessService
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.DependsOn
import org.springframework.context.annotation.Lazy
import org.springframework.core.Ordered.HIGHEST_PRECEDENCE
import org.springframework.core.annotation.Order
import org.springframework.core.env.Environment
import org.springframework.core.io.ResourceLoader
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EnableJpaRepositories(
    basePackageClasses = [
        BuildingBlockDefinitionRepository::class,
        ProcessDefinitionBuildingBlockDefinitionRepository::class,
        BuildingBlockDefinitionArtworkRepository::class
    ]
)
@EntityScan(basePackages = ["com.ritense.buildingblock.domain", "com.ritense.buildingblock.processlink.domain"])
class BuildingBlockAutoConfiguration {
    @Order(HIGHEST_PRECEDENCE + 27)
    @ConditionalOnMissingBean(name = ["buildingBlockLiquibaseMasterChangeLogLocation"])
    @Bean
    fun buildingBlockLiquibaseMasterChangeLogLocation(): LiquibaseMasterChangeLogLocation {
        return LiquibaseMasterChangeLogLocation("config/liquibase/building-block-master.xml")
    }

    @Order(270)
    @Bean
    @ConditionalOnMissingBean(BuildingBlockHttpSecurityConfigurer::class)
    fun buildingBlockHttpSecurityConfigurer(): BuildingBlockHttpSecurityConfigurer {
        return BuildingBlockHttpSecurityConfigurer()
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDocumentDefinitionService::class)
    fun buildingBlockDocumentDefinitionService(
        repository: JsonSchemaDocumentDefinitionRepository,
        checker: BuildingBlockDefinitionChecker
    ): BuildingBlockDocumentDefinitionService {
        return BuildingBlockDocumentDefinitionService(repository, checker)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDefinitionProcessDefinitionService::class)
    fun buildingBlockDefinitionProcessDefinitionService(
        repositoryService: RepositoryService,
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
        operatonProcessService: OperatonProcessService,
        processLinkService: ProcessLinkService,
        processLinkMappers: List<ProcessLinkMapper>,
        processDeploymentService: ProcessDeploymentService,
        authorizationService: AuthorizationService,
        buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker
    ): BuildingBlockDefinitionProcessDefinitionService {
        return BuildingBlockDefinitionProcessDefinitionService(
            repositoryService,
            processDefinitionBuildingBlockDefinitionRepository,
            operatonProcessService,
            processLinkService,
            processLinkMappers,
            processDeploymentService,
            authorizationService,
            buildingBlockDefinitionChecker
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDefinitionArtworkService::class)
    fun buildingBlockDefinitionArtworkService(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        buildingBlockDefinitionArtworkRepository: BuildingBlockDefinitionArtworkRepository,
        authroizationService: AuthorizationService
    ): BuildingBlockDefinitionArtworkService {
        return BuildingBlockDefinitionArtworkService(
            buildingBlockDefinitionRepository,
            buildingBlockDefinitionArtworkRepository,
            authroizationService
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockManagementService::class)
    fun buildingBlockManagementService(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService,
        buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
        buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker
    ): BuildingBlockManagementService {
        return BuildingBlockManagementService(
            buildingBlockDefinitionRepository,
            buildingBlockDocumentDefinitionService,
            buildingBlockDefinitionProcessDefinitionService,
            buildingBlockDefinitionChecker
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockManagementResource::class)
    fun buildingBlockManagementResource(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        buildingBlockManagementService: BuildingBlockManagementService,
        importService: ImportService
    ): BuildingBlockManagementResource {
        return BuildingBlockManagementResource(
            buildingBlockDefinitionRepository,
            buildingBlockManagementService,
            importService
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDocumentDefinitionResource::class)
    fun buildingBlockDocumentDefinitionResource(
        buildingBlockJsonSchemaDocumentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
        service: JsonSchemaDocumentDefinitionService,
        objectMapper: ObjectMapper
    ): BuildingBlockDocumentDefinitionResource {
        return BuildingBlockDocumentDefinitionResource(
            buildingBlockJsonSchemaDocumentDefinitionRepository,
            service,
            objectMapper
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockProcessResource::class)
    fun buildingBlockProcessResource(
        buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
        buildingBlockPluginDefinitionService: BuildingBlockPluginDefinitionService,
    ): BuildingBlockProcessResource {
        return BuildingBlockProcessResource(
            buildingBlockDefinitionProcessDefinitionService,
            buildingBlockPluginDefinitionService
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDefinitionArtworkResource::class)
    fun buildingBlockDefinitionArtworkResource(
        buildingBlockDefinitionArtworkService: BuildingBlockDefinitionArtworkService
    ): BuildingBlockDefinitionArtworkResource {
        return BuildingBlockDefinitionArtworkResource(buildingBlockDefinitionArtworkService)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDefinitionChecker::class)
    fun buildingBlockDefinitionChecker(
        repository: BuildingBlockDefinitionRepository,
        environment: Environment,
        @Value("\${valtimo.draft.environments:inttest,dev,test}") draftEnvironments: String,
        @Value("\${valtimo.draft.enabled:false}") draftsEnabled: Boolean,
    ) = BuildingBlockDefinitionCheckerImpl(repository, environment, draftEnvironments, draftsEnabled)

    @Bean
    @DependsOn("importService") // TODO: Figure out why this is needed
    fun buildingBlockDefinitionDeploymentService(
        resourceLoader: ResourceLoader,
        valtimoImportService: ValtimoImportService,
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        applicationEventPublisher: ApplicationEventPublisher,
    ): BuildingBlockDefinitionDeploymentService {
        return BuildingBlockDefinitionDeploymentService(
            resourceLoader,
            valtimoImportService,
            buildingBlockDefinitionRepository,
            applicationEventPublisher
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDefinitionImporter::class)
    fun buildingBlockDefinitionImporter(
        objectMapper: ObjectMapper,
        repository: BuildingBlockDefinitionRepository,
        checker: BuildingBlockDefinitionChecker
    ) = BuildingBlockDefinitionImporter(objectMapper, repository, checker)

    @Bean
    @ConditionalOnMissingBean(BuildingBlockProcessLinkMapper::class)
    fun buildingBlockProcessLinkMapper(
        objectMapper: ObjectMapper,
        @Lazy processLinkService: ProcessLinkService,
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository
    ) = BuildingBlockProcessLinkMapper(objectMapper, processLinkService, processDefinitionBuildingBlockDefinitionRepository)

    @Bean
    @ConditionalOnMissingBean(BuildingBlockSupportedProcessLinksHandler::class)
    fun buildingBlockSupportedProcessLinksHandler() = BuildingBlockSupportedProcessLinksHandler()

    @Bean
    @ConditionalOnMissingBean(BuildingBlockPluginConfigurationResolver::class)
    fun buildingBlockPluginConfigurationResolver(): BuildingBlockPluginConfigurationResolver =
        DefaultBuildingBlockPluginConfigurationResolver()

    @Bean
    @ConditionalOnMissingBean(BuildingBlockCallActivityListener::class)
    fun buildingBlockCallActivityListener(
        processLinkService: ProcessLinkService,
    ) = BuildingBlockCallActivityListener(processLinkService)

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDefinitionMainProcessDefinitionImporter::class)
    fun buildingBlockDefinitionMainProcessDefinitionImporter(
        objectMapper: ObjectMapper,
        operatonProcessService: OperatonProcessService,
        buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
    ) = BuildingBlockDefinitionMainProcessDefinitionImporter(
        objectMapper,
        operatonProcessService,
        buildingBlockDefinitionProcessDefinitionService
    )

    @Bean
    @ConditionalOnMissingBean(ProcessDefinitionBuildingBlockDefinitionImporter::class)
    fun processDefinitionBuildingBlockDefinitionImporter(
        operatonProcessService: OperatonProcessService,
        buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
    ) = ProcessDefinitionBuildingBlockDefinitionImporter(
        operatonProcessService,
        buildingBlockDefinitionProcessDefinitionService
    )

    @Bean
    @ConditionalOnMissingBean(BuildingBlockJsonSchemaDocumentDefinitionImporter::class)
    fun buildingBlockJsonSchemaDocumentDefinitionImporter(
        service: BuildingBlockDocumentDefinitionService,
    ) = BuildingBlockJsonSchemaDocumentDefinitionImporter(service)

    @Bean
    @ConditionalOnMissingBean(BuildingBlockPluginDefinitionService::class)
    fun buildingBlockPluginDefinitionService(
        pluginProcessLinkRepository: ValtimoPluginProcessLinkRepository,
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository
    ) = BuildingBlockPluginDefinitionService(pluginProcessLinkRepository, processDefinitionBuildingBlockDefinitionRepository)

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDefinitionArtworkImporter::class)
    fun buildingBlockDefinitionArtworkImporter(
        buildingBlockDefinitionArtworkService: BuildingBlockDefinitionArtworkService
    ): BuildingBlockDefinitionArtworkImporter {
        return BuildingBlockDefinitionArtworkImporter(buildingBlockDefinitionArtworkService)
    }
}