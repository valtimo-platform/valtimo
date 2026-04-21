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

package com.ritense.valtimo.security.config;

import static com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN;
import static org.springframework.http.HttpMethod.GET;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.http.HttpMethod.PUT;
import static org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher.pathPattern;

import com.ritense.valtimo.contract.security.config.HttpConfigurerConfigurationException;
import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;

public class ProcessHttpSecurityConfigurer implements HttpSecurityConfigurer {

    @Override
    public void configure(HttpSecurity http) {
        try {
            http.authorizeHttpRequests(requests ->
                requests.requestMatchers(pathPattern(GET, "/api/v1/process/definition")).authenticated()
                .requestMatchers(pathPattern(POST, "/api/v1/process/definition/{processDefinitionId}/count")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/definition/{processDefinitionId}/xml")).authenticated()
                .requestMatchers(pathPattern(PUT, "/api/v1/process/definition/{processDefinitionId}/xml/timer")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/definition/{processDefinitionKey}/search-properties")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/definition/{processDefinitionKey}")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/definition/{processDefinitionKey}/versions")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/definition/{processDefinitionKey}/start-form")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/definition/{processDefinitionKey}/usertasks")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/definition/{processDefinitionKey}/heatmap/count")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/definition/{processDefinitionKey}/heatmap/duration")).authenticated()
                .requestMatchers(pathPattern(POST, "/api/v1/process/definition/{processDefinitionKey}/{businessKey}/start")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/definition/{sourceProcessDefinitionId}/{targetProcessDefinitionId}/flownodes"))
                    .authenticated()
                .requestMatchers(pathPattern(POST, "/api/v1/process/definition/{sourceProcessDefinitionId}/{targetProcessDefinitionId}/migrate"))
                    .hasAuthority(ADMIN)
                .requestMatchers(pathPattern(GET, "/api/v1/process/{processInstanceId}")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/{processInstanceId}/history")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/{processInstanceId}/log")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/{processInstanceId}/tasks")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/{processInstanceId}/activetask")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/{processInstanceId}/xml")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/{processInstanceId}/activities")).authenticated()
                .requestMatchers(pathPattern(GET, "/api/v1/process/{processInstanceId}/comments")).authenticated()
                .requestMatchers(pathPattern(POST, "/api/v1/process/{processDefinitionName}/search")).authenticated()
                .requestMatchers(pathPattern(POST, "/api/v2/process/{processDefinitionName}/search")).authenticated()
                .requestMatchers(pathPattern(POST, "/api/v1/process/{processDefinitionName}/count")).authenticated()
                .requestMatchers(pathPattern(POST, "/api/v1/process/{processInstanceId}/comment")).authenticated()
                .requestMatchers(pathPattern(POST, "/api/v1/process/{processInstanceId}/delete")).hasAuthority(ADMIN)
                .requestMatchers(pathPattern(POST, "/api/v1/process/definition/deployment")).hasAuthority(ADMIN)
            );
        } catch (Exception e) {
            throw new HttpConfigurerConfigurationException(e);
        }
    }

}
