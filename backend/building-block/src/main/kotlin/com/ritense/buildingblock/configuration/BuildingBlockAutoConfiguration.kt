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
import com.ritense.buildingblock.endpoint.BuildingBlockEndpointDescriptionProvider
import com.ritense.buildingblock.listener.CaseDefinitionBuildingBlockLinkCaseEventListener
import com.ritense.buildingblock.listener.BuildingBlockCaseAssigneeListener
import com.ritense.buildingblock.listener.BuildingBlockDefinitionEventListener
import com.ritense.buildingblock.listener.BuildingBlockEndEventListener
import com.ritense.buildingblock.listener.BuildingBlockStartEventListener
import com.ritense.buildingblock.listener.BuildingBlockTaskTeamAutoAssignListener
import com.ritense.buildingblock.listener.CaseDefinitionBuildingBlockLinkCaseEventListener
import com.ritense.buildingblock.processlink.mapper.BuildingBlockProcessLinkMapper
import com.ritense.buildingblock.processlink.service.BuildingBlockCallActivityListener
import com.ritense.buildingblock.processlink.service.BuildingBlockSupportedProcessLinksHandler
import com.ritense.buildingblock.processlink.service.DefaultBuildingBlockPluginConfigurationResolver
import com.ritense.buildingblock.repository.BuildingBlockDefinitionArtworkRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.JsonSchemaDocumentCaseDefinitionMapper
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.security.config.BuildingBlockHttpSecurityConfigurer
import com.ritense.buildingblock.service.BuildingBlockCaseDefinitionFinalizationChecker
import com.ritense.buildingblock.service.BuildingBlockCaseDocumentResolver
import com.ritense.buildingblock.service.BuildingBlockCaseLogScopeContributor
import com.ritense.buildingblock.service.BuildingBlockCaseTaskContributor
import com.ritense.buildingblock.service.BuildingBlockDecisionDefinitionExporter
import com.ritense.buildingblock.service.BuildingBlockDecisionDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockDecisionService
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
import com.ritense.buildingblock.service.BuildingBlockFormFlowDefinitionExporter
import com.ritense.buildingblock.service.BuildingBlockFormFlowDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockFormFlowDefinitionService
import com.ritense.buildingblock.service.BuildingBlockInstanceService
import com.ritense.buildingblock.service.BuildingBlockJsonSchemaDocumentDefinitionExporter
import com.ritense.buildingblock.service.BuildingBlockJsonSchemaDocumentDefinitionImporter
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.service.BuildingBlockPluginDefinitionService
import com.ritense.buildingblock.service.BuildingBlockProcessDefinitionExporter
import com.ritense.buildingblock.service.BuildingBlockProcessDefinitionLinkExporter
import com.ritense.buildingblock.service.BuildingBlockProcessLinkExporter
import com.ritense.buildingblock.service.BuildingBlockProcessLinkImporter
import com.ritense.buildingblock.service.BuildingBlockProcessLookupImpl
import com.ritense.buildingblock.service.CaseDefinitionBuildingBlockLinkExporter
import com.ritense.buildingblock.service.CaseDefinitionBuildingBlockLinkImporter
import com.ritense.buildingblock.service.CaseDefinitionBuildingBlockLinkService
import com.ritense.buildingblock.service.ProcessDefinitionBuildingBlockDefinitionImporter
import com.ritense.buildingblock.service.StartableBuildingBlockItemProvider
import com.ritense.buildingblock.web.rest.BuildingBlockDecisionManagementResource
import com.ritense.buildingblock.web.rest.BuildingBlockDefinitionArtworkResource
import com.ritense.buildingblock.web.rest.BuildingBlockDocumentDefinitionResource
import com.ritense.buildingblock.web.rest.BuildingBlockFieldResource
import com.ritense.buildingblock.web.rest.BuildingBlockFormFlowManagementResource
import com.ritense.buildingblock.web.rest.BuildingBlockFormManagementResource
import com.ritense.buildingblock.web.rest.BuildingBlockInstanceResource
import com.ritense.buildingblock.web.rest.BuildingBlockManagementResource
import com.ritense.buildingblock.web.rest.BuildingBlockProcessResource
import com.ritense.buildingblock.web.rest.BuildingBlockValueResolverResource
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case.service.finalization.CaseDefinitionFinalizationChecker
import com.ritense.document.autoconfiguration.DocumentAuthorizationAutoConfiguration
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.document.service.DocumentService
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.exporter.ExportService
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.formflow.service.FormFlowService
import com.ritense.importer.ImportService
import com.ritense.importer.ValtimoImportService
import com.ritense.plugin.service.BuildingBlockPluginConfigurationResolver
import com.ritense.plugin.service.PluginService
import com.ritense.processdocument.service.BuildingBlockProcessLookup
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processlink.exporter.BuildingBlockProcessLinkToBuildingBlockMapper
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.processlink.repository.ValtimoPluginProcessLinkRepository
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.authentication.TeamManagementService
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import com.ritense.valtimo.service.OperatonByteArrayService
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
import org.springframework.jdbc.core.JdbcTemplate

@AutoConfiguration(before = [DocumentAuthorizationAutoConfiguration::class])
@EnableJpaRepositories(
    basePackageClasses = [
        BuildingBlockDefinitionRepository::class,
        ProcessDefinitionBuildingBlockDefinitionRepository::class,
        BuildingBlockDefinitionArtworkRepository::class,
        BuildingBlockInstanceRepository::class,
        CaseDefinitionBuildingBlockLinkRepository::class
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
        checker: BuildingBlockDefinitionChecker,
        objectMapper: ObjectMapper
    ): BuildingBlockDocumentDefinitionService {
        return BuildingBlockDocumentDefinitionService(repository, checker, objectMapper)
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
        operatonProcessService: OperatonProcessService,
        buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService,
        buildingBlockFormFlowDefinitionService: BuildingBlockFormFlowDefinitionService,
        processLinkRepository: ProcessLinkRepository,
        buildingBlockDecisionService: BuildingBlockDecisionService,
    ): BuildingBlockDefinitionEventListener {
        return BuildingBlockDefinitionEventListener(
            buildingBlockDefinitionRepository,
            jsonSchemaDocumentDefinitionRepository,
            processDefinitionBuildingBlockDefinitionRepository,
            buildingBlockDefinitionArtworkRepository,
            buildingBlockDocumentDefinitionService,
            operatonProcessService,
            buildingBlockFormDefinitionService,
            buildingBlockFormFlowDefinitionService,
            processLinkRepository,
            buildingBlockDecisionService,
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
        documentService: DocumentService,
        authorizationService: AuthorizationService
    ): BuildingBlockInstanceService {
        return BuildingBlockInstanceService(
            buildingBlockInstanceRepository,
            buildingBlockDefinitionRepository,
            documentService,
            authorizationService
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
    @ConditionalOnMissingBean(BuildingBlockCaseLogScopeContributor::class)
    fun buildingBlockCaseLogScopeContributor(
        buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
        processDocumentAssociationService: ProcessDocumentAssociationService,
    ): BuildingBlockCaseLogScopeContributor {
        return BuildingBlockCaseLogScopeContributor(
            buildingBlockInstanceRepository,
            processDocumentAssociationService,
        )
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
    @ConditionalOnMissingBean(BuildingBlockProcessLookup::class)
    fun buildingBlockProcessLookup(
        buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    ): BuildingBlockProcessLookup {
        return BuildingBlockProcessLookupImpl(buildingBlockInstanceRepository)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockInstanceResource::class)
    fun buildingBlockInstanceResource(
        buildingBlockInstanceService: BuildingBlockInstanceService,
        documentService: DocumentService,
        authorizationService: AuthorizationService,
    ): BuildingBlockInstanceResource {
        return BuildingBlockInstanceResource(
            buildingBlockInstanceService,
            documentService,
            authorizationService,
        )
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
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
        repositoryService: RepositoryService,
    ) = BuildingBlockProcessLinkMapper(
        objectMapper,
        processLinkService,
        processDefinitionBuildingBlockDefinitionRepository,
        repositoryService,
    )

    @Bean
    @ConditionalOnMissingBean(name = ["jsonSchemaDocumentCaseDefinitionMapper"])
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
        linkRepository: CaseDefinitionBuildingBlockLinkRepository,
        documentService: DocumentService,
    ): BuildingBlockPluginConfigurationResolver =
        DefaultBuildingBlockPluginConfigurationResolver(
            buildingBlockInstanceService,
            processLinkService,
            linkRepository,
            documentService,
        )

    @Bean
    @ConditionalOnMissingBean(BuildingBlockCaseAssigneeListener::class)
    fun buildingBlockCaseAssigneeListener(
        operatonTaskService: OperatonTaskService,
        documentService: DocumentService,
        caseDefinitionService: CaseDefinitionService,
        userManagementService: UserManagementService,
        caseDocumentResolver: CaseDocumentResolver,
        authorizationService: AuthorizationService,
        buildingBlockInstanceRepository: BuildingBlockInstanceRepository
    ) = BuildingBlockCaseAssigneeListener(
        operatonTaskService,
        documentService,
        caseDefinitionService,
        userManagementService,
        caseDocumentResolver,
        buildingBlockInstanceRepository,
        authorizationService,
    )

    @Bean
    @ConditionalOnMissingBean(BuildingBlockTaskTeamAutoAssignListener::class)
    fun buildingBlockTaskTeamAutoAssignListener(
        operatonTaskService: OperatonTaskService,
        documentService: DocumentService,
        caseDefinitionService: CaseDefinitionService,
        buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
        teamManagementService: TeamManagementService?,
        caseDocumentResolver: CaseDocumentResolver,
    ) = BuildingBlockTaskTeamAutoAssignListener(
        operatonTaskService,
        documentService,
        caseDefinitionService,
        buildingBlockInstanceRepository,
        teamManagementService,
        caseDocumentResolver,
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
    @ConditionalOnMissingBean(BuildingBlockStartEventListener::class)
    fun buildingBlockStartEventListener(
        buildingBlockInstanceService: BuildingBlockInstanceService,
        processDocumentService: ProcessDocumentService,
        operatonRepositoryService: OperatonRepositoryService,
        caseDocumentResolver: CaseDocumentResolver,
        objectMapper: ObjectMapper,
        caseDefinitionBuildingBlockLinkService: CaseDefinitionBuildingBlockLinkService,
        documentService: DocumentService,
        valueResolverService: ValueResolverService,
        processDocumentAssociationService: ProcessDocumentAssociationService,
        jdbcTemplate: JdbcTemplate,
    ) = BuildingBlockStartEventListener(
        buildingBlockInstanceService,
        processDocumentService,
        operatonRepositoryService,
        caseDocumentResolver,
        objectMapper,
        caseDefinitionBuildingBlockLinkService,
        documentService,
        valueResolverService,
        processDocumentAssociationService,
        jdbcTemplate,
    )

    @Bean
    @ConditionalOnMissingBean(BuildingBlockEndEventListener::class)
    fun buildingBlockEndEventListener(
        buildingBlockInstanceService: BuildingBlockInstanceService,
        caseDefinitionBuildingBlockLinkService: CaseDefinitionBuildingBlockLinkService,
        processDocumentService: ProcessDocumentService,
        documentService: DocumentService,
        valueResolverService: ValueResolverService,
    ) = BuildingBlockEndEventListener(
        buildingBlockInstanceService,
        caseDefinitionBuildingBlockLinkService,
        processDocumentService,
        documentService,
        valueResolverService,
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
        buildingBlockDecisionService: BuildingBlockDecisionService,
    ) = BuildingBlockDefinitionExporter(
        objectMapper,
        buildingBlockDefinitionRepository,
        documentDefinitionService,
        formDefinitionRepository,
        buildingBlockDecisionService
    )

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
    @ConditionalOnMissingBean(CaseDefinitionBuildingBlockLinkService::class)
    fun caseDefinitionBuildingBlockLinkService(
        caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository
    ): CaseDefinitionBuildingBlockLinkService {
        return CaseDefinitionBuildingBlockLinkService(
            caseDefinitionBuildingBlockLinkRepository,
            buildingBlockDefinitionRepository
        )
    }

    @Bean
    @ConditionalOnMissingBean(StartableBuildingBlockItemProvider::class)
    fun startableBuildingBlockItemProvider(
        caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
        authorizationService: AuthorizationService,
        caseDefinitionBuildingBlockLinkService: CaseDefinitionBuildingBlockLinkService,
        objectMapper: ObjectMapper,
    ): StartableBuildingBlockItemProvider {
        return StartableBuildingBlockItemProvider(
            caseDefinitionBuildingBlockLinkRepository,
            processDefinitionBuildingBlockDefinitionRepository,
            authorizationService,
            caseDefinitionBuildingBlockLinkService,
            objectMapper,
        )
    }

    @Bean
    @ConditionalOnMissingBean(CaseDefinitionBuildingBlockLinkExporter::class)
    fun caseDefinitionBuildingBlockLinkExporter(
        objectMapper: ObjectMapper,
        caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository
    ): CaseDefinitionBuildingBlockLinkExporter {
        return CaseDefinitionBuildingBlockLinkExporter(objectMapper, caseDefinitionBuildingBlockLinkRepository)
    }

    @Bean
    @ConditionalOnMissingBean(CaseDefinitionBuildingBlockLinkImporter::class)
    fun caseDefinitionBuildingBlockLinkImporter(
        objectMapper: ObjectMapper,
        caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository
    ): CaseDefinitionBuildingBlockLinkImporter {
        return CaseDefinitionBuildingBlockLinkImporter(objectMapper, caseDefinitionBuildingBlockLinkRepository)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockCaseDefinitionFinalizationChecker::class)
    fun buildingBlockCaseDefinitionFinalizationChecker(
        operatonProcessService: OperatonProcessService,
        processLinkService: ProcessLinkService,
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
        caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    ): CaseDefinitionFinalizationChecker =
        BuildingBlockCaseDefinitionFinalizationChecker(
            operatonProcessService,
            processLinkService,
            buildingBlockDefinitionRepository,
            processDefinitionBuildingBlockDefinitionRepository,
            caseDefinitionBuildingBlockLinkRepository
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

    @Bean
    @ConditionalOnMissingBean(CaseDefinitionBuildingBlockLinkCaseEventListener::class)
    fun caseDefinitionBuildingBlockLinkCaseEventListener(
        linkRepository: CaseDefinitionBuildingBlockLinkRepository,
    ) = CaseDefinitionBuildingBlockLinkCaseEventListener(linkRepository)

    @Bean
    @ConditionalOnMissingBean(BuildingBlockFormFlowDefinitionService::class)
    fun buildingBlockFormFlowDefinitionService(
        formFlowService: FormFlowService,
        definitionChecker: BuildingBlockDefinitionChecker
    ): BuildingBlockFormFlowDefinitionService {
        return BuildingBlockFormFlowDefinitionService(formFlowService, definitionChecker)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockFormFlowManagementResource::class)
    fun buildingBlockFormFlowManagementResource(
        buildingBlockFormFlowDefinitionService: BuildingBlockFormFlowDefinitionService,
        buildingBlockFormFlowDefinitionImporter: BuildingBlockFormFlowDefinitionImporter,
    ): BuildingBlockFormFlowManagementResource {
        return BuildingBlockFormFlowManagementResource(
            buildingBlockFormFlowDefinitionService,
            buildingBlockFormFlowDefinitionImporter
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockFormFlowDefinitionExporter::class)
    fun buildingBlockFormFlowDefinitionExporter(
        objectMapper: ObjectMapper,
        formFlowService: FormFlowService
    ): BuildingBlockFormFlowDefinitionExporter {
        return BuildingBlockFormFlowDefinitionExporter(objectMapper, formFlowService)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockFormFlowDefinitionImporter::class)
    fun buildingBlockFormFlowDefinitionImporter(
        formFlowService: FormFlowService,
        objectMapper: ObjectMapper,
        resourceLoader: ResourceLoader,
    ): BuildingBlockFormFlowDefinitionImporter {
        return BuildingBlockFormFlowDefinitionImporter(formFlowService, objectMapper, resourceLoader)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDecisionService::class)
    fun buildingBlockDecisionService(
        repositoryService: RepositoryService,
        buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
        operatonByteArrayService: OperatonByteArrayService,
        operatonProcessService: OperatonProcessService
    ): BuildingBlockDecisionService {
        return BuildingBlockDecisionService(repositoryService, buildingBlockDefinitionChecker, operatonByteArrayService, operatonProcessService)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDecisionManagementResource::class)
    fun buildingBlockDecisionManagementResource(
        buildingBlockDecisionService: BuildingBlockDecisionService
    ): BuildingBlockDecisionManagementResource {
        return BuildingBlockDecisionManagementResource(buildingBlockDecisionService)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDecisionDefinitionImporter::class)
    fun buildingBlockDecisionDefinitionImporter(
        operatonProcessService: OperatonProcessService
    ): BuildingBlockDecisionDefinitionImporter {
        return BuildingBlockDecisionDefinitionImporter(operatonProcessService)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDecisionDefinitionExporter::class)
    fun buildingBlockDecisionDefinitionExporter(
        repositoryService: RepositoryService
    ): BuildingBlockDecisionDefinitionExporter {
        return BuildingBlockDecisionDefinitionExporter(repositoryService)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockEndpointDescriptionProvider::class)
    fun buildingBlockEndpointDescriptionProvider() = BuildingBlockEndpointDescriptionProvider()
}
