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

package com.ritense.team.autoconfigure

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.team.authorization.TeamSpecificationFactory
import com.ritense.team.exporter.TeamExporter
import com.ritense.team.importer.TeamImporter
import com.ritense.team.repository.TeamRepository
import com.ritense.team.repository.TeamUserRepository
import com.ritense.team.security.config.TeamHttpSecurityConfigurer
import com.ritense.team.service.TeamActionProvider
import com.ritense.team.service.TeamService
import com.ritense.team.web.rest.TeamResource
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.database.QueryDialectHelper
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Lazy
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@Configuration
@EntityScan("com.ritense.team.domain")
@EnableJpaRepositories("com.ritense.team.repository")
class TeamAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(TeamService::class)
    fun teamService(
        teamRepository: TeamRepository,
        teamUserRepository: TeamUserRepository,
        authorizationService: AuthorizationService,
    ): TeamService {
        return TeamService(teamRepository, teamUserRepository, authorizationService)
    }

    @Bean
    @ConditionalOnMissingBean(TeamActionProvider::class)
    fun teamActionProvider(): TeamActionProvider {
        return TeamActionProvider()
    }

    @Bean
    @ConditionalOnMissingBean(TeamResource::class)
    fun teamResource(
        teamService: TeamService,
        userManagementService: UserManagementService
    ): TeamResource {
        return TeamResource(teamService, userManagementService)
    }

    @Order(270)
    @Bean
    @ConditionalOnMissingBean(TeamHttpSecurityConfigurer::class)
    fun teamHttpSecurityConfigurer(): TeamHttpSecurityConfigurer {
        return TeamHttpSecurityConfigurer()
    }

    @Bean
    @ConditionalOnMissingBean(TeamExporter::class)
    fun teamExporter(
        objectMapper: ObjectMapper,
        teamService: TeamService
    ): TeamExporter {
        return TeamExporter(objectMapper, teamService)
    }

    @Bean
    @ConditionalOnMissingBean(TeamImporter::class)
    fun teamImporter(
        objectMapper: ObjectMapper,
        teamService: TeamService
    ): TeamImporter {
        return TeamImporter(objectMapper, teamService)
    }

    @Bean
    @ConditionalOnMissingBean(TeamSpecificationFactory::class)
    fun teamSpecificationFactory(
        @Lazy teamService: TeamService,
        queryDialectHelper: QueryDialectHelper
    ): TeamSpecificationFactory {
        return TeamSpecificationFactory(teamService, queryDialectHelper)
    }
}
