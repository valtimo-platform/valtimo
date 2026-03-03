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

package com.ritense.buildingblock.configuration

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.buildingblock.listener.BuildingBlockCaseAssigneeListener
import com.ritense.buildingblock.listener.BuildingBlockDefinitionEventListener
import com.ritense.buildingblock.processlink.mapper.BuildingBlockProcessLinkMapper
import com.ritense.buildingblock.processlink.service.BuildingBlockCallActivityListener
import com.ritense.buildingblock.processlink.service.BuildingBlockSupportedProcessLinksHandler
import com.ritense.buildingblock.processlink.service.DefaultBuildingBlockPluginConfigurationResolver
import com.ritense.buildingblock.repository.BuildingBlockDefinitionArtworkRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.JsonSchemaDocumentCaseDefinitionMapper
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.security.config.BuildingBlockHttpSecurityConfigurer
import com.ritense.buildingblock.service.BuildingBlockCaseDefinitionFinalizationChecker
import com.ritense.buildingblock.service.BuildingBlockCaseDocumentResolver
import com.ritense.buildingblock.service.BuildingBlockCaseTaskContributor
import com.ritense.buildingblock.service.BuildingBlockDefinitionArtworkExporter
import com.ritense.buildingblock.service.BuildingBlockDefinitionArtworkImporter
import com.ritense.buildingblock.service.BuildingBlockDefinitionArtworkService
import com.ritense.buildingblock.service.BuildingBlockDefinitionCheckerImpl
import com.ritense.buildingblock.service.BuildingBlockDefinitionDeploymentService
import com.ritense.buildingblock.service.BuildingBlockDefinitionExporter
import com.ritense.buildingblock.service.BuildingBlockDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockDefinitionMainProcessDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockDefinitionProcessDefinitionService
import com.ritense.buildingblock.service.BuildingBlockDocumentDefinitionService
import com.ritense.buildingblock.service.BuildingBlockFieldService
import com.ritense.buildingblock.service.BuildingBlockFormDefinitionExporter
import com.ritense.buildingblock.service.BuildingBlockFormDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockFormDefinitionService
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.buildingblock.service.BuildingBlockJsonSchemaDocumentDefinitionExporter
import com.ritense.buildingblock.service.BuildingBlockJsonSchemaDocumentDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.service.BuildingBlockPluginDefinitionService
import com.ritense.buildingblock.service.BuildingBlockProcessDefinitionExporter
import com.ritense.buildingblock.service.BuildingBlockProcessDefinitionLinkExporter
import com.ritense.buildingblock.service.BuildingBlockProcessLinkExporter
import com.ritense.buildingblock.service.BuildingBlockProcessLinkImporter
import com.ritense.buildingblock.service.ProcessDefinitionBuildingBlockDefinitionImporter
import com.ritense.buildingblock.web.rest.BuildingBlockDefinitionArtworkResource
import com.ritense.buildingblock.web.rest.BuildingBlockDocumentDefinitionResource
import com.ritense.buildingblock.web.rest.BuildingBlockFieldResource
import com.ritense.buildingblock.web.rest.BuildingBlockFormManagementResource
import com.ritense.buildingblock.web.rest.BuildingBlockManagementResource
import com.ritense.buildingblock.web.rest.BuildingBlockProcessResource
import com.ritense.buildingblock.web.rest.BuildingBlockValueResolverResource
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.service.finalization.CaseDefinitionFinalizationChecker
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.document.service.DocumentService
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.exporter.ExportService
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.importer.ImportService
import com.ritense.importer.ValtimoImportService
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.plugin.service.PluginService
import com.ritense.processlink.exporter.BuildingBlockProcessLinkToBuildingBlockMapper
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.service.OperatonProcessService
import com.ritense.valtimo.service.OperatonTaskService
import com.ritense.valueresolver.ValueResolverService
import org.operaton.bpm.engine.RepositoryService
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.DependsOn
import org.springframework.context.annotation.Lazy
import org.springframework.core.annotation.Order
import org.springframework.core.env.Environment
import org.springframework.core.io.ResourceLoader
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EnableJpaRepositories(
    basePackageClasses = [
        BuildingBlockDefinitionRepository::class,
        ProcessDefinitionBuildingBlockDefinitionRepository::class,
        BuildingBlockDefinitionArtworkRepository::class,
        BuildingBlockInstanceRepository::class
    ]
)
@EntityScan(basePackages = ["com.ritense.buildingblock.domain", "com.ritense.buildingblock.processlink.domain"])
class BuildingBlockAutoConfiguration {
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
    @ConditionalOnMissingBean(BuildingBlockFieldService::class)
    fun buildingBlockFieldService(
        jsonSchemaDocumentDefinitionRepository: JsonSchemaDocumentDefinitionRepository
    ): BuildingBlockFieldService {
        return BuildingBlockFieldService(jsonSchemaDocumentDefinitionRepository)
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
    @ConditionalOnMissingBean(BuildingBlockDefinitionEventListener::class)
    fun buildingBlockDefinitionEventListener(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        jsonSchemaDocumentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
        buildingBlockDefinitionArtworkRepository: BuildingBlockDefinitionArtworkRepository,
        buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService,
        operatonProcessService: OperatonProcessService
    ): BuildingBlockDefinitionEventListener {
        return BuildingBlockDefinitionEventListener(
            buildingBlockDefinitionRepository,
            jsonSchemaDocumentDefinitionRepository,
            processDefinitionBuildingBlockDefinitionRepository,
            buildingBlockDefinitionArtworkRepository,
            buildingBlockDocumentDefinitionService,
            operatonProcessService
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
    @ConditionalOnMissingBean(BuildingBlockProcessLinkToBuildingBlockMapper::class)
    fun buildingBlockProcessLinkToBuildingBlockMapper() =
        com.ritense.buildingblock.service.BuildingBlockProcessLinkToBuildingBlockMapper()

    @Bean
    @ConditionalOnMissingBean(BuildingBlockInstanceService::class)
    fun buildingBlockInstanceService(
        buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        documentService: DocumentService
    ): BuildingBlockInstanceService {
        return BuildingBlockInstanceService(
            buildingBlockInstanceRepository,
            buildingBlockDefinitionRepository,
            documentService
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockCaseDocumentResolver::class)
    fun buildingBlockCaseDocumentResolver(
        buildingBlockInstanceRepository: BuildingBlockInstanceRepository
    ): BuildingBlockCaseDocumentResolver {
        return BuildingBlockCaseDocumentResolver(buildingBlockInstanceRepository)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockCaseTaskContributor::class)
    fun buildingBlockCaseTaskContributor(
        queryDialectHelper: QueryDialectHelper
    ): BuildingBlockCaseTaskContributor {
        return BuildingBlockCaseTaskContributor(queryDialectHelper)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockManagementService::class)
    fun buildingBlockManagementService(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService,
        buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
        buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
        authorizationService: AuthorizationService,
        applicationEventPublisher: ApplicationEventPublisher
    ): BuildingBlockManagementService {
        return BuildingBlockManagementService(
            buildingBlockDefinitionRepository,
            buildingBlockDocumentDefinitionService,
            buildingBlockDefinitionProcessDefinitionService,
            buildingBlockDefinitionChecker,
            authorizationService,
            applicationEventPublisher
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockManagementResource::class)
    fun buildingBlockManagementResource(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        buildingBlockManagementService: BuildingBlockManagementService,
        importService: ImportService,
        exportService: ExportService,
    ): BuildingBlockManagementResource {
        return BuildingBlockManagementResource(
            buildingBlockDefinitionRepository,
            buildingBlockManagementService,
            importService,
            exportService
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDocumentDefinitionResource::class)
    fun buildingBlockDocumentDefinitionResource(
        jsonSchemaDocumentDefinitionService: JsonSchemaDocumentDefinitionService,
        buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService,
        objectMapper: ObjectMapper
    ): BuildingBlockDocumentDefinitionResource {
        return BuildingBlockDocumentDefinitionResource(
            jsonSchemaDocumentDefinitionService,
            buildingBlockDocumentDefinitionService,
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
    @ConditionalOnMissingBean(BuildingBlockFieldResource::class)
    fun buildingBlockFieldResource(
        buildingBlockFieldService: BuildingBlockFieldService
    ): BuildingBlockFieldResource {
        return BuildingBlockFieldResource(buildingBlockFieldService)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockValueResolverResource::class)
    fun buildingBlockValueResolverResource(
        valueResolverService: ValueResolverService
    ): BuildingBlockValueResolverResource {
        return BuildingBlockValueResolverResource(valueResolverService)
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
        objectMapper: ObjectMapper,
    ): BuildingBlockDefinitionDeploymentService {
        return BuildingBlockDefinitionDeploymentService(
            resourceLoader,
            valtimoImportService,
            buildingBlockDefinitionRepository,
            applicationEventPublisher,
            objectMapper
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
    ) = BuildingBlockProcessLinkMapper(
        objectMapper,
        processLinkService,
        processDefinitionBuildingBlockDefinitionRepository
    )

    @Bean
    @ConditionalOnMissingBean(JsonSchemaDocumentCaseDefinitionMapper::class)
    fun jsonSchemaDocumentCaseDefinitionMapper(
        @Lazy caseDocumentResolver: CaseDocumentResolver,
        @Lazy documentService: JsonSchemaDocumentService,
        @Lazy caseDefinitionService: CaseDefinitionService,
    ): JsonSchemaDocumentCaseDefinitionMapper {
        return JsonSchemaDocumentCaseDefinitionMapper(
            caseDocumentResolver,
            documentService,
            caseDefinitionService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockSupportedProcessLinksHandler::class)
    fun buildingBlockSupportedProcessLinksHandler() = BuildingBlockSupportedProcessLinksHandler()

    @Bean
    @ConditionalOnMissingBean(BuildingBlockPluginConfigurationResolver::class)
    fun buildingBlockPluginConfigurationResolver(
        buildingBlockInstanceService: BuildingBlockInstanceService,
        @Lazy processLinkService: ProcessLinkService,
    ): BuildingBlockPluginConfigurationResolver =
        DefaultBuildingBlockPluginConfigurationResolver(
            buildingBlockInstanceService,
            processLinkService
        )

    @Bean
    @ConditionalOnMissingBean(BuildingBlockCaseAssigneeListener::class)
    fun buildingBlockCaseAssigneeListener(
        operatonTaskService: OperatonTaskService,
        documentService: DocumentService,
        caseDefinitionService: CaseDefinitionService,
        userManagementService: UserManagementService,
        caseDocumentResolver: CaseDocumentResolver,
        buildingBlockInstanceRepository: BuildingBlockInstanceRepository
    ) = BuildingBlockCaseAssigneeListener(
        operatonTaskService,
        documentService,
        caseDefinitionService,
        userManagementService,
        caseDocumentResolver,
        buildingBlockInstanceRepository
    )

    @Bean
    @ConditionalOnMissingBean(BuildingBlockCallActivityListener::class)
    fun buildingBlockCallActivityListener(
        processLinkService: ProcessLinkService,
        buildingBLockInstanceService: BuildingBlockInstanceService,
        valueResolverService: ValueResolverService,
        objectMapper: ObjectMapper,
        operatonRepositoryService: OperatonRepositoryService,
    ) = BuildingBlockCallActivityListener(
        processLinkService,
        buildingBLockInstanceService,
        valueResolverService,
        objectMapper,
        operatonRepositoryService
    )

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
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
        pluginService: PluginService,
        processLinkService: ProcessLinkService
    ) = BuildingBlockPluginDefinitionService(
        pluginProcessLinkRepository,
        processDefinitionBuildingBlockDefinitionRepository,
        pluginService,
        processLinkService
    )

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDefinitionArtworkImporter::class)
    fun buildingBlockDefinitionArtworkImporter(
        buildingBlockDefinitionArtworkService: BuildingBlockDefinitionArtworkService
    ): BuildingBlockDefinitionArtworkImporter {
        return BuildingBlockDefinitionArtworkImporter(buildingBlockDefinitionArtworkService)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockProcessLinkImporter::class)
    fun buildingBlockProcessLinkImporter(
        processLinkService: ProcessLinkService,
        objectMapper: ObjectMapper,
        buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService
    ) = BuildingBlockProcessLinkImporter(
        processLinkService,
        objectMapper,
        buildingBlockDefinitionProcessDefinitionService
    )

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDefinitionExporter::class)
    fun buildingBlockDefinitionExporter(
        objectMapper: ObjectMapper,
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        documentDefinitionService: DocumentDefinitionService,
        formDefinitionRepository: FormDefinitionRepository,
    ) = BuildingBlockDefinitionExporter(objectMapper, buildingBlockDefinitionRepository, documentDefinitionService, formDefinitionRepository)

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDefinitionArtworkExporter::class)
    fun buildingBlockDefinitionArtworkExporter(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository
    ) = BuildingBlockDefinitionArtworkExporter(buildingBlockDefinitionRepository)

    @Bean
    @ConditionalOnMissingBean(BuildingBlockJsonSchemaDocumentDefinitionExporter::class)
    fun buildingBlockJsonSchemaDocumentDefinitionExporter(
        objectMapper: ObjectMapper,
        documentDefinitionService: JsonSchemaDocumentDefinitionService
    ) = BuildingBlockJsonSchemaDocumentDefinitionExporter(objectMapper, documentDefinitionService)

    @Bean
    @ConditionalOnMissingBean(BuildingBlockProcessDefinitionExporter::class)
    fun buildingBlockProcessDefinitionExporter(
        operatonRepositoryService: OperatonRepositoryService,
        repositoryService: RepositoryService,
    ) = BuildingBlockProcessDefinitionExporter(operatonRepositoryService, repositoryService)

    @Bean
    @ConditionalOnMissingBean(BuildingBlockProcessDefinitionLinkExporter::class)
    fun buildingBlockProcessDefinitionLinkExporter(
        objectMapper: ObjectMapper,
        repositoryService: RepositoryService,
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    ) = BuildingBlockProcessDefinitionLinkExporter(
        objectMapper,
        repositoryService,
        processDefinitionBuildingBlockDefinitionRepository
    )

    @Bean
    @ConditionalOnMissingBean(BuildingBlockProcessLinkExporter::class)
    fun buildingBlockProcessLinkExporter(
        processLinkService: ProcessLinkService,
        objectMapper: ObjectMapper,
        repositoryService: RepositoryService,
        processLinkMappers: List<ProcessLinkMapper>,
        buildingBlockMapper: BuildingBlockProcessLinkToBuildingBlockMapper,
    ) = BuildingBlockProcessLinkExporter(
        processLinkService,
        objectMapper,
        repositoryService,
        processLinkMappers,
        buildingBlockMapper
    )

    @Bean
    @ConditionalOnMissingBean(CaseDefinitionFinalizationChecker::class)
    fun buildingBlockCaseDefinitionFinalizationChecker(
        operatonProcessService: OperatonProcessService,
        processLinkService: ProcessLinkService,
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    ): CaseDefinitionFinalizationChecker =
        BuildingBlockCaseDefinitionFinalizationChecker(
            operatonProcessService,
            processLinkService,
            buildingBlockDefinitionRepository,
            processDefinitionBuildingBlockDefinitionRepository
        )

    @Bean
    @ConditionalOnMissingBean(BuildingBlockFormDefinitionService::class)
    fun buildingBlockFormDefinitionService(
        formDefinitionRepository: FormDefinitionRepository,
        definitionChecker: BuildingBlockDefinitionChecker
    ): BuildingBlockFormDefinitionService {
        return BuildingBlockFormDefinitionService(formDefinitionRepository, definitionChecker)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockFormManagementResource::class)
    fun buildingBlockFormManagementResource(
        buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService
    ): BuildingBlockFormManagementResource {
        return BuildingBlockFormManagementResource(buildingBlockFormDefinitionService)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockFormDefinitionExporter::class)
    fun buildingBlockFormDefinitionExporter(
        objectMapper: ObjectMapper,
        buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService
    ): BuildingBlockFormDefinitionExporter {
        return BuildingBlockFormDefinitionExporter(objectMapper, buildingBlockFormDefinitionService)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockFormDefinitionImporter::class)
    fun buildingBlockFormDefinitionImporter(
        buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService
    ): BuildingBlockFormDefinitionImporter {
        return BuildingBlockFormDefinitionImporter(buildingBlockFormDefinitionService)
    }
}
