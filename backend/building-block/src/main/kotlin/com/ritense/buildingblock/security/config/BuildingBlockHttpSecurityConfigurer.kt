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
import org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher

class BuildingBlockHttpSecurityConfigurer : HttpSecurityConfigurer {
    override fun configure(http: HttpSecurity) {
        try {
            http.authorizeHttpRequests { requests ->
                requests
                    .requestMatchers(antMatcher(GET, MANAGEMENT_BASE_PATH)).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(POST, MANAGEMENT_BASE_PATH)).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(PUT, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/document")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(PUT, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/document")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(POST, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/finalize")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/process-definition")).hasAuthority(ADMIN)
                    .requestMatchers(
                        antMatcher(
                            GET,
                            "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/process-definition/{processDefinitionId}"
                        )
                    ).hasAuthority(ADMIN)
                    .requestMatchers(
                        antMatcher(
                            POST,
                            "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/process-definition/{processDefinitionId}"
                        )
                    ).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(POST, "$MANAGEMENT_BASE_PATH/import")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(GET, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/artwork")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(POST, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/artwork")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(DELETE, "$MANAGEMENT_BASE_PATH/{key}/version/{versionTag}/artwork")).hasAuthority(ADMIN)
            }
        } catch (e: Exception) {
            throw HttpConfigurerConfigurationException(e)
        }
    }

    companion object {
        const val MANAGEMENT_BASE_PATH: String = "/api/management/v1/building-block"
    }
}