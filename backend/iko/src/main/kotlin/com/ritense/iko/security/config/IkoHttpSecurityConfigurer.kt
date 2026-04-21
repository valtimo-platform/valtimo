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

package com.ritense.iko.security.config

import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.security.config.HttpConfigurerConfigurationException
import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer
import org.springframework.http.HttpMethod.DELETE
import org.springframework.http.HttpMethod.GET
import org.springframework.http.HttpMethod.POST
import org.springframework.http.HttpMethod.PUT
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher.pathPattern

class IkoHttpSecurityConfigurer : HttpSecurityConfigurer {

    override fun configure(http: HttpSecurity) {
        try {
            http.authorizeHttpRequests { requests ->
                requests
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-types")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-property-fields/{type}/repository-config")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko/{ikoKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/management/v1/iko/{ikoKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "/api/management/v1/iko/{ikoKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "/api/management/v1/iko/{ikoKey}")).hasAuthority(ADMIN)

                    .requestMatchers(pathPattern(GET, "/api/v1/iko-view")).authenticated()
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-property-fields/{type}/view")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-view")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-view/{viewKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/management/v1/iko-view/{viewKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "/api/management/v1/iko-view/{viewKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "/api/management/v1/iko-view/{viewKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-view/{viewKey}/export")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/management/v1/iko-view/import")).hasAuthority(ADMIN)

                    .requestMatchers(pathPattern(GET, "/api/v1/iko-view/{viewKey}/search-action")).authenticated()
                    .requestMatchers(pathPattern(POST, "/api/v1/iko-view/{viewKey}/search-action/{actionKey}/search")).authenticated()
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-property-fields/{type}/search-action")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-view/{viewKey}/search-action")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-view/{viewKey}/search-action/{actionKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/management/v1/iko-view/{viewKey}/search-action/{actionKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "/api/management/v1/iko-view/{viewKey}/search-action/{actionKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "/api/management/v1/iko-view/{viewKey}/search-action")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "/api/management/v1/iko-view/{viewKey}/search-action/{actionKey}")).hasAuthority(ADMIN)

                    .requestMatchers(pathPattern(GET, "/api/v1/iko-view/{viewKey}/tab")).authenticated()
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-property-fields/{type}/tab")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-view/{viewKey}/tab")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET, "/api/management/v1/iko-view/{viewKey}/tab/{tabKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST, "/api/management/v1/iko-view/{viewKey}/tab/{tabKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "/api/management/v1/iko-view/{viewKey}/tab/{tabKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT, "/api/management/v1/iko-view/{viewKey}/tab")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE, "/api/management/v1/iko-view/{viewKey}/tab/{tabKey}")).hasAuthority(ADMIN)

                    .requestMatchers(pathPattern(GET,"/api/v1/iko-view/{viewKey}/tab/{tabKey}/widget")).authenticated()
                    .requestMatchers(pathPattern(GET,"/api/v1/iko-view/{viewKey}/tab/{tabKey}/widget/{widgetKey}/data")).authenticated()
                    .requestMatchers(pathPattern(GET,"/api/management/v1/iko-view/{viewKey}/tab/{tabKey}/widget")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET,"/api/management/v1/iko-view/{viewKey}/tab/{tabKey}/widget/{widgetKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST,"/api/management/v1/iko-view/{viewKey}/tab/{tabKey}/widget/{widgetKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT,"/api/management/v1/iko-view/{viewKey}/tab/{tabKey}/widget/{widgetKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT,"/api/management/v1/iko-view/{viewKey}/tab/{tabKey}/widget")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE,"/api/management/v1/iko-view/{viewKey}/tab/{tabKey}/widget/{widgetKey}")).hasAuthority(ADMIN)

                    .requestMatchers(pathPattern(GET,"/api/management/v1/iko-view/{viewKey}/column")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET,"/api/management/v1/iko-view/{viewKey}/column/{columnKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST,"/api/management/v1/iko-view/{viewKey}/column/{columnKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT,"/api/management/v1/iko-view/{viewKey}/column/{columnKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT,"/api/management/v1/iko-view/{viewKey}/column")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE,"/api/management/v1/iko-view/{viewKey}/column/{columnKey}")).hasAuthority(ADMIN)

                    .requestMatchers(pathPattern(GET,"/api/management/v1/iko-view/{viewKey}/search-action/{actionKey}/search-field")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(GET,"/api/management/v1/iko-view/{viewKey}/search-action/{actionKey}/search-field/{fieldKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(POST,"/api/management/v1/iko-view/{viewKey}/search-action/{actionKey}/search-field/{fieldKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT,"/api/management/v1/iko-view/{viewKey}/search-action/{actionKey}/search-field/{fieldKey}")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(PUT,"/api/management/v1/iko-view/{viewKey}/search-action/{actionKey}/search-field")).hasAuthority(ADMIN)
                    .requestMatchers(pathPattern(DELETE,"/api/management/v1/iko-view/{viewKey}/search-action/{actionKey}/search-field/{fieldKey}")).hasAuthority(ADMIN)
            }
        } catch (e: Exception) {
            throw HttpConfigurerConfigurationException(e)
        }
    }
}
