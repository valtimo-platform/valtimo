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

package com.ritense.buildingblock.security.config

import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.security.config.HttpConfigurerConfigurationException
import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer
import org.springframework.http.HttpMethod.DELETE
import org.springframework.http.HttpMethod.GET
import org.springframework.http.HttpMethod.POST
import org.springframework.http.HttpMethod.PUT
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher.pathPattern

class BuildingBlockHttpSecurityConfigurer : HttpSecurityConfigurer {
    override fun configure(http: HttpSecurity) {
        try {
            http.authorizeHttpRequests { requests ->
                requests
                    .requestMatchers(pathPattern(GET, MANAGEMENT_BASE_PATH)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, MANAGEMENT_BASE_PATH)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/document")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/document")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/draft")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/export")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/finalize")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/plugin")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/fields")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/process-definition/{processDefinitionId}/is-building-block")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/process-definition")).hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            GET,
                            "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/process-definition/{processDefinitionId}"
                        )
                    ).hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            POST,
                            "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/process-definition/{processDefinitionId}"
                        )
                    ).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "$MANAGEMENT_BASE_PATH/import")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/artwork"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/artwork"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/artwork"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            GET,
                            "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/process-definition/main/key"
                        )
                    ).hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            POST,
                            "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/process-definition/{processDefinitionId}/main"
                        )
                    ).hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            DELETE,
                            "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/process-definition/{processDefinitionId}"
                        )
                    ).hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            POST,
                            "$VALUE_RESOLVER_BASE_PATH/{key}/version/{versionTag}/keys"
                        )
                    ).hasAuthority(ADMIN)
                    // Form option endpoint
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form-option"))
                    .hasAuthority(ADMIN)
                    // Form management endpoints
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form/{formDefinitionId}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form/{formDefinitionId}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form/{formDefinitionId}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form/name/{name}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form/{name}/exists"))
                    .hasAuthority(ADMIN)
                    // Form flow management endpoints
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form-flow-definition"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form-flow-definition"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form-flow-definition/{definitionKey}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form-flow-definition/{definitionKey}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/form-flow-definition/{definitionKey}"))
                    .hasAuthority(ADMIN)
            }
        } catch (e: Exception) {
            throw HttpConfigurerConfigurationException(e)
        }
    }

    companion object {
        const val MANAGEMENT_BASE_PATH: String = "/api/management/v1/building-block"
        const val VALUE_RESOLVER_BASE_PATH: String = "/api/management/v1/value-resolver/building-block"
    }
}