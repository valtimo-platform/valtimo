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

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import java.io.IOException;
import org.operaton.bpm.engine.IdentityService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.GenericFilterBean;

/**
 * Propagates the request's authenticated principal (set by Spring Security's
 * OAuth2 resource-server flow) onto Operaton's {@link IdentityService} so that
 * engine APIs invoked during the request — most notably
 * {@code formService.submitStartForm(...)} and
 * {@code runtimeService.startProcessInstance...} — capture a non-null
 * {@code startUserId} on the new historic process instance.
 *
 * <p>This is the OAuth2-resource-server equivalent of {@code JwtFilter}, which
 * is only wired in by {@code JwtHttpSecurityConfigurer} when no OAuth2 client
 * is configured. Apps using Spring's OAuth2 stack (e.g. Keycloak) relied on
 * no equivalent until this filter was introduced.
 */
public class OperatonIdentityBridgeFilter extends GenericFilterBean {

    private final IdentityService identityService;

    public OperatonIdentityBridgeFilter(IdentityService identityService) {
        this.identityService = identityService;
    }

    @Override
    public void doFilter(
        ServletRequest request,
        ServletResponse response,
        FilterChain chain
    ) throws IOException, ServletException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String authenticatedUserId = authentication != null ? authentication.getName() : null;
        // Always set (including null) — Operaton's identity is a thread-local that
        // may have been left dirty by a previous request running on the same thread.
        identityService.setAuthenticatedUserId(authenticatedUserId);
        try {
            chain.doFilter(request, response);
        } finally {
            identityService.clearAuthentication();
        }
    }
}
