/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

package com.ritense.marketplace.web.rest

import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.security.config.HttpConfigurerConfigurationException
import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer
import org.springframework.http.HttpMethod.DELETE
import org.springframework.http.HttpMethod.GET
import org.springframework.http.HttpMethod.POST
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher

class PackageSecurityConfigurer : HttpSecurityConfigurer {

    override fun configure(http: HttpSecurity) {
        try {
            http.authorizeHttpRequests { requests ->
                requests
                    // management
                    // The literal sub-paths (store/job/refresh/upload) are declared BEFORE
                    // the {id} patterns: matchers are evaluated in order, and "/package/store"
                    // would otherwise be matched by "/package/{id}" with id="store".
                    .requestMatchers(antMatcher(GET, "/api/management/v1/package")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(GET, "/api/management/v1/package/store")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(GET, "/api/management/v1/package/job")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(GET, "/api/management/v1/package/job/{jobId}")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(POST, "/api/management/v1/package/refresh")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(POST, "/api/management/v1/package/upload")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(GET, "/api/management/v1/package/{id}")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(GET, "/api/management/v1/package/{id}/job")).hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(POST, "/api/management/v1/package/{id}/preflight"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(POST, "/api/management/v1/package/{id}/install/{version}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(POST, "/api/management/v1/package/{id}/update/{version}"))
                    .hasAuthority(ADMIN)
                    .requestMatchers(antMatcher(DELETE, "/api/management/v1/package/{id}")).hasAuthority(ADMIN)

                    // public
                    .requestMatchers(antMatcher(GET, "/api/v1/public/package/id")).permitAll()
                    .requestMatchers(antMatcher(GET, "/api/v1/public/package/{packageId}/file/**")).permitAll()
            }
        } catch (e: Exception) {
            throw HttpConfigurerConfigurationException(e)
        }
    }
}