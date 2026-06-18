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

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.operaton.bpm.engine.IdentityService;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class OperatonIdentityBridgeFilterTest {

    private IdentityService identityService;
    private OperatonIdentityBridgeFilter filter;
    private HttpServletRequest request;
    private HttpServletResponse response;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        identityService = mock(IdentityService.class);
        filter = new OperatonIdentityBridgeFilter(identityService);
        request = mock(HttpServletRequest.class);
        response = mock(HttpServletResponse.class);
        chain = mock(FilterChain.class);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldSetAuthenticatedUserIdFromPrincipalNameAndClearAfterRequest() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("alice@example.com", "n/a", List.of(new SimpleGrantedAuthority("ROLE_USER")))
        );

        filter.doFilter(request, response, chain);

        InOrder inOrder = inOrder(identityService, chain);
        inOrder.verify(identityService).setAuthenticatedUserId(eq("alice@example.com"));
        inOrder.verify(chain).doFilter(request, response);
        inOrder.verify(identityService).clearAuthentication();
    }

    @Test
    void shouldSetNullUserIdWhenNoAuthenticationPresent() throws Exception {
        SecurityContextHolder.clearContext();

        filter.doFilter(request, response, chain);

        verify(identityService).setAuthenticatedUserId(eq((String) null));
        verify(chain).doFilter(request, response);
        verify(identityService).clearAuthentication();
    }

    @Test
    void shouldUseAnonymousUserPrincipalNameWhenAuthenticationIsAnonymous() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
            new AnonymousAuthenticationToken("key", "anonymousUser",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")))
        );

        filter.doFilter(request, response, chain);

        verify(identityService).setAuthenticatedUserId(eq("anonymousUser"));
    }

    @Test
    void shouldClearAuthenticationEvenIfChainThrows() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("bob", "n/a", List.of())
        );
        doThrow(new ServletException("boom")).when(chain).doFilter(request, response);

        assertThrows(ServletException.class, () -> filter.doFilter(request, response, chain));

        verify(identityService).setAuthenticatedUserId("bob");
        verify(identityService).clearAuthentication();
    }
}
