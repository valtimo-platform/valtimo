/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.processlink.security.config

import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.security.config.HttpConfigurerConfigurationException
import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer
import org.springframework.http.HttpMethod.DELETE
import org.springframework.http.HttpMethod.GET
import org.springframework.http.HttpMethod.POST
import org.springframework.http.HttpMethod.PUT
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher.pathPattern

class ProcessLinkHttpSecurityConfigurer : HttpSecurityConfigurer {

    override fun configure(http: HttpSecurity) {
        try {
            http.authorizeHttpRequests { requests ->
                requests.requestMatchers(pathPattern(GET, PROCESS_LINK_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$PROCESS_LINK_URL/types")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, PROCESS_LINK_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, PROCESS_LINK_URL)).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "$PROCESS_LINK_URL/export")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "$PROCESS_LINK_URL/{processLinkId}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/v1/process/definition/deployment/process-link"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/v2/process-link/task/{taskId}")).authenticated()
                    .requestMatchers(pathPattern(GET, "/api/v1/process-definition/{processDefinitionId}/start-form"))
                    .authenticated()
                    .requestMatchers(pathPattern(GET, "/api/v1/process/{processInstanceId}/tasks/process-link"))
                    .authenticated()
                    .requestMatchers(
                        pathPattern(
                            GET,
                            "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition"
                        )
                    )
                    .hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            POST,
                            "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition"
                        )
                    )
                    .hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            DELETE,
                            "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition/key/{processDefinitionKey}"
                        )
                    )
                    .hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            GET,
                            "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition/key/{processDefinitionKey}"
                        )
                    )
                    .hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            GET,
                            "/api/management/v1/process-definition"
                        )
                    )
                    .hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            GET,
                            "/api/management/v1/process-definition/{processDefinitionId}"
                        )
                    )
                    .hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            POST,
                            "/api/management/v1/process-definition"
                        )
                    )
                    .hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            DELETE,
                            "/api/management/v1/process-definition/key/{processDefinitionKey}"
                        )
                    )
                    .hasAuthority(ADMIN)
                    .requestMatchers(
                        pathPattern(
                            GET,
                            "/api/management/v1/process-definition/key/{processDefinitionKey}"
                        )
                    ).hasAuthority(ADMIN)
            }
        } catch (e: Exception) {
            throw HttpConfigurerConfigurationException(e)
        }
    }

    companion object {
        private const val PROCESS_LINK_URL = "/api/v1/process-link"
    }
}
