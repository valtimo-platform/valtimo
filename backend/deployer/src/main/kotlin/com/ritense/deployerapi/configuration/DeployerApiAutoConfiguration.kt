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

package com.ritense.deployerapi.configuration

import com.ritense.case.service.CaseDefinitionService
import com.ritense.deployerapi.security.config.DeployerApiHttpSecurityConfigurer
import com.ritense.deployerapi.web.rest.DeployerCaseDefinitionResource
import com.ritense.deployerapi.web.rest.DeployerOpenApiResource
import org.springdoc.core.models.GroupedOpenApi
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order

@AutoConfiguration
class DeployerApiAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(DeployerCaseDefinitionResource::class)
    fun deployerCaseDefinitionResource(
        caseDefinitionService: CaseDefinitionService,
    ): DeployerCaseDefinitionResource {
        return DeployerCaseDefinitionResource(caseDefinitionService)
    }

    @Bean
    @ConditionalOnMissingBean(DeployerOpenApiResource::class)
    fun deployerOpenApiResource(): DeployerOpenApiResource {
        return DeployerOpenApiResource()
    }

    @Order(301)
    @Bean
    @ConditionalOnMissingBean(DeployerApiHttpSecurityConfigurer::class)
    fun deployerApiHttpSecurityConfigurer(): DeployerApiHttpSecurityConfigurer {
        return DeployerApiHttpSecurityConfigurer()
    }

    @Bean
    fun deployerGroupedOpenApi(): GroupedOpenApi {
        return GroupedOpenApi.builder()
            .group("deployer")
            .pathsToMatch("/api/deployer/v1/**")
            .addOpenApiCustomizer { openApi ->
                // Remove FieldErrorVM schema injected by global exception handler
                openApi.components?.schemas?.remove("FieldErrorVM")
            }
            .build()
    }
}
