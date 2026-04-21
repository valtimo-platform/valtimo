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
import com.ritense.team.service.TeamManagementServiceImpl
import com.ritense.team.web.rest.TeamResource
import com.ritense.valtimo.contract.authentication.TeamManagementService
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.database.QueryDialectHelper
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.persistence.autoconfigure.EntityScan
import org.springframework.context.ApplicationEventPublisher
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
    @ConditionalOnMissingBean(TeamManagementServiceImpl::class)
    fun teamManagementService(
        teamRepository: TeamRepository,
        teamUserRepository: TeamUserRepository,
        @Lazy authorizationService: AuthorizationService,
        eventPublisher: ApplicationEventPublisher,
    ): TeamManagementServiceImpl {
        return TeamManagementServiceImpl(
            teamRepository,
            teamUserRepository,
            authorizationService,
            eventPublisher
        )
    }

    @Bean
    @ConditionalOnMissingBean(TeamActionProvider::class)
    fun teamActionProvider(): TeamActionProvider {
        return TeamActionProvider()
    }

    @Bean
    @ConditionalOnMissingBean(TeamResource::class)
    fun teamResource(
        teamManagementService: TeamManagementService,
        userManagementService: UserManagementService,
    ): TeamResource {
        return TeamResource(
            teamManagementService,
            userManagementService,
        )
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
        teamManagementService: TeamManagementService
    ): TeamExporter {
        return TeamExporter(objectMapper, teamManagementService)
    }

    @Bean
    @ConditionalOnMissingBean(TeamImporter::class)
    fun teamImporter(
        objectMapper: ObjectMapper,
        teamManagementService: TeamManagementService
    ): TeamImporter {
        return TeamImporter(objectMapper, teamManagementService)
    }

    @Bean
    @ConditionalOnMissingBean(TeamSpecificationFactory::class)
    fun teamSpecificationFactory(
        @Lazy teamManagementService: TeamManagementService,
        queryDialectHelper: QueryDialectHelper
    ): TeamSpecificationFactory {
        return TeamSpecificationFactory(teamManagementService, queryDialectHelper)
    }
}
