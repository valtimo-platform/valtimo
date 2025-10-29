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
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockJsonSchemaDocumentDefinitionRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.security.config.BuildingBlockHttpSecurityConfigurer
import com.ritense.buildingblock.service.BuildingBlockDocumentDefinitionService
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.service.BuildingBlockProcessService
import com.ritense.buildingblock.web.rest.BuildingBlockDocumentDefinitionResource
import com.ritense.buildingblock.web.rest.BuildingBlockManagementResource
import com.ritense.buildingblock.web.rest.BuildingBlockProcessResource
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.config.LiquibaseMasterChangeLogLocation
import com.ritense.valtimo.service.OperatonProcessService
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
        processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
        operatonProcessService: OperatonProcessService,
        processLinkService: ProcessLinkService,
        processLinkMappers: List<ProcessLinkMapper>,
        processDeploymentService: ProcessDeploymentService
    ): BuildingBlockProcessService {
        return BuildingBlockProcessService(
            repositoryService,
            processDefinitionBuildingBlockDefinitionRepository,
            operatonProcessService,
            processLinkService,
            processLinkMappers,
            processDeploymentService
        )
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
    @ConditionalOnMissingBean(BuildingBlockManagementResource::class)
    fun buildingBlockManagementResource(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
        buildingBlockManagementService: BuildingBlockManagementService
    ): BuildingBlockManagementResource {
        return BuildingBlockManagementResource(
            buildingBlockDefinitionRepository,
            buildingBlockManagementService
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockDocumentDefinitionResource::class)
    fun buildingBlockDocumentDefinitionResource(
        buildingBlockJsonSchemaDocumentDefinitionRepository: BuildingBlockJsonSchemaDocumentDefinitionRepository,
        objectMapper: ObjectMapper
    ): BuildingBlockDocumentDefinitionResource {
        return BuildingBlockDocumentDefinitionResource(
            buildingBlockJsonSchemaDocumentDefinitionRepository,
            objectMapper
        )
    }

    @Bean
    @ConditionalOnMissingBean(BuildingBlockProcessResource::class)
    fun buildingBlockProcessResource(
        buildingBlockProcessService: BuildingBlockProcessService,
    ): BuildingBlockProcessResource {
        return BuildingBlockProcessResource(
            buildingBlockProcessService,
        )
    }
}