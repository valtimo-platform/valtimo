package com.ritense.buildingblock.configuration

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockJsonSchemaDocumentDefinitionRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.security.config.BuildingBlockHttpSecurityConfigurer
import com.ritense.buildingblock.service.BuildingBlockDocumentDefinitionService
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.service.BuildingBlockProcessService
import com.ritense.buildingblock.web.rest.BuildingBlockManagementResource
import com.ritense.valtimo.contract.config.LiquibaseMasterChangeLogLocation
import org.operaton.bpm.engine.RepositoryService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Bean
import org.springframework.core.Ordered.HIGHEST_PRECEDENCE
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EnableJpaRepositories(
    basePackageClasses = [
        BuildingBlockDefinitionRepository::class,
        BuildingBlockJsonSchemaDocumentDefinitionRepository::class,
        ProcessDefinitionBuildingBlockDefinitionRepository::class
    ]
)
@EntityScan(basePackages = ["com.ritense.buildingblock.domain"])
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
        repository: BuildingBlockJsonSchemaDocumentDefinitionRepository
    ): BuildingBlockDocumentDefinitionService {
        return BuildingBlockDocumentDefinitionService(repository)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockProcessService::class)
    fun buildingBlockProcessService(
        repositoryService: RepositoryService,
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository
    ): BuildingBlockProcessService {
        return BuildingBlockProcessService(repositoryService, processDefinitionBuildingBlockDefinitionRepository)
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockManagementService::class)
    fun buildingBlockManagementService(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService,
        buildingBlockProcessService: BuildingBlockProcessService
    ): BuildingBlockManagementService {
        return BuildingBlockManagementService(
            buildingBlockDefinitionRepository,
            buildingBlockDocumentDefinitionService,
            buildingBlockProcessService
        )
    }

    @Bean
    @ConditionalOnMissingBean(name = ["buildingBlockDefinitionResource"])
    fun buildingBlockManagementResource(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        buildingBlockManagementService: BuildingBlockManagementService
    ): BuildingBlockManagementResource {
        return BuildingBlockManagementResource(
            buildingBlockDefinitionRepository,
            buildingBlockManagementService
        )
    }
}