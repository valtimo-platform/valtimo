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

package com.ritense.valtimo.security.oauth2;

import com.ritense.valtimo.contract.security.config.HttpConfigurerConfigurationException;
import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer;
import org.operaton.bpm.engine.IdentityService;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;

/**
 * Wires {@link OperatonIdentityBridgeFilter} into the Spring Security chain,
 * positioned after the anonymous-authentication filter so by the time it runs
 * the {@code SecurityContext} has been populated by whichever authentication
 * filter handled the request (Bearer token, form login, etc.).
 */
public class OperatonIdentityBridgeHttpSecurityConfigurer implements HttpSecurityConfigurer {

    private final IdentityService identityService;

    public OperatonIdentityBridgeHttpSecurityConfigurer(IdentityService identityService) {
        this.identityService = identityService;
    }

    @Override
    public void configure(HttpSecurity http) {
        try {
            http.addFilterAfter(
                new OperatonIdentityBridgeFilter(identityService),
                AnonymousAuthenticationFilter.class
            );
        } catch (Exception e) {
            throw new HttpConfigurerConfigurationException(e);
        }
    }
}
