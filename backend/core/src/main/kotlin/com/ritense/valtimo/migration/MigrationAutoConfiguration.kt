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

package com.ritense.valtimo.migration

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valtimo.migration.domain.ProcessMigrationConfiguration
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Bean
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EnableJpaRepositories(basePackageClasses = [ProcessMigrationConfigurationRepository::class])
@EntityScan(basePackageClasses = [ProcessMigrationConfiguration::class])
class MigrationAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(ProcessMigrationComponentDeployer::class)
    fun processMigrationComponentDeployer(
        objectMapper: ObjectMapper,
        processMigrationConfigurationRepository: ProcessMigrationConfigurationRepository,
    ) = ProcessMigrationComponentDeployer(objectMapper, processMigrationConfigurationRepository)
}
