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

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockJsonSchemaDocumentDefinitionRepository
import com.ritense.buildingblock.security.config.BuildingBlockHttpSecurityConfigurer
import com.ritense.buildingblock.web.rest.BuildingBlockManagementResource
import com.ritense.valtimo.contract.config.LiquibaseMasterChangeLogLocation
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

    @ConditionalOnMissingBean(name = ["buildingBlockDefinitionResource"])
    @Bean
    fun buildingBlockManagementResource(
        buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    ): BuildingBlockManagementResource {
        return BuildingBlockManagementResource(
            buildingBlockDefinitionRepository
        )
    }
}