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

package com.ritense.case_.configuration

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.case_.caseconfiguration.exporter.CaseConfigurationExporter
import com.ritense.case_.caseconfiguration.importer.CaseConfigurationImporter
import com.ritense.case_.caseconfiguration.listener.CaseConfigurationCaseEventListener
import com.ritense.case_.caseconfiguration.repository.CaseConfigurationDeclarationRepository
import com.ritense.case_.caseconfiguration.repository.CaseConfigurationEnvironmentValueRepository
import com.ritense.case_.caseconfiguration.security.CaseConfigurationHttpSecurityConfigurer
import com.ritense.case_.caseconfiguration.service.CaseConfigurationService
import com.ritense.case_.caseconfiguration.web.rest.CaseConfigurationManagementResource
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EnableJpaRepositories(basePackageClasses = [CaseConfigurationDeclarationRepository::class])
@EntityScan(basePackages = ["com.ritense.case_.caseconfiguration.domain"])
class CaseConfigurationAutoConfiguration {

    @Order(295)
    @Bean
    @ConditionalOnMissingBean(CaseConfigurationHttpSecurityConfigurer::class)
    fun caseConfigurationHttpSecurityConfigurer() = CaseConfigurationHttpSecurityConfigurer()

    @Bean
    @ConditionalOnMissingBean(CaseConfigurationService::class)
    fun caseConfigurationService(
        declarationRepository: CaseConfigurationDeclarationRepository,
        environmentValueRepository: CaseConfigurationEnvironmentValueRepository,
        caseDefinitionRepository: CaseDefinitionRepository,
        caseDefinitionChecker: CaseDefinitionChecker,
        authorizationService: AuthorizationService,
    ) = CaseConfigurationService(
        declarationRepository,
        environmentValueRepository,
        caseDefinitionRepository,
        caseDefinitionChecker,
        authorizationService,
    )

    @Bean
    @ConditionalOnMissingBean(CaseConfigurationManagementResource::class)
    fun caseConfigurationManagementResource(caseConfigurationService: CaseConfigurationService) =
        CaseConfigurationManagementResource(caseConfigurationService)

    @Bean
    @ConditionalOnMissingBean(CaseConfigurationImporter::class)
    fun caseConfigurationImporter(objectMapper: ObjectMapper, caseConfigurationService: CaseConfigurationService) =
        CaseConfigurationImporter(objectMapper, caseConfigurationService)

    @Bean
    @ConditionalOnMissingBean(CaseConfigurationExporter::class)
    fun caseConfigurationExporter(objectMapper: ObjectMapper, caseConfigurationService: CaseConfigurationService) =
        CaseConfigurationExporter(objectMapper, caseConfigurationService)

    @Bean
    @ConditionalOnMissingBean(CaseConfigurationCaseEventListener::class)
    fun caseConfigurationCaseEventListener(caseConfigurationService: CaseConfigurationService) =
        CaseConfigurationCaseEventListener(caseConfigurationService)
}
