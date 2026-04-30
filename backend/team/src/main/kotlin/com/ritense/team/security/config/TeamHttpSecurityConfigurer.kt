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

package com.ritense.team.security.config

import com.ritense.valtimo.contract.security.config.HttpConfigurerConfigurationException
import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher

class TeamHttpSecurityConfigurer : HttpSecurityConfigurer {

    override fun configure(http: HttpSecurity) {
        try {
            http.authorizeHttpRequests { requests ->
                requests.requestMatchers(antMatcher(HttpMethod.GET, "/api/v1/team")).authenticated()
                    .requestMatchers(antMatcher(HttpMethod.GET, "/api/v1/team/{id}")).authenticated()
                    .requestMatchers(antMatcher(HttpMethod.POST, "/api/v1/team"))
                    .authenticated()
                    .requestMatchers(antMatcher(HttpMethod.PUT, "/api/v1/team/{id}"))
                    .authenticated()
                    .requestMatchers(antMatcher(HttpMethod.DELETE, "/api/v1/team/{id}"))
                    .authenticated()
                    .requestMatchers(antMatcher(HttpMethod.GET, "/api/v1/team/{teamKey}/user")).authenticated()
                    .requestMatchers(antMatcher(HttpMethod.POST, "/api/v1/team/{teamKey}/user")).authenticated()
                    .requestMatchers(antMatcher(HttpMethod.DELETE, "/api/v1/team/{teamKey}/user/{userId}"))
                    .authenticated()
                    .requestMatchers(antMatcher(HttpMethod.GET, "/api/v1/team/{teamKey}/candidate-user"))
                    .authenticated()
                    .requestMatchers(antMatcher(HttpMethod.GET, "/api/v1/case/{caseId}/team")).authenticated()
                    .requestMatchers(antMatcher(HttpMethod.POST, "/api/v1/case/{caseId}/team")).authenticated()
                    .requestMatchers(antMatcher(HttpMethod.DELETE, "/api/v1/case/{caseId}/team/{teamKey}"))
                    .authenticated()
            }
        } catch (e: Exception) {
            throw HttpConfigurerConfigurationException(e)
        }
    }
}
