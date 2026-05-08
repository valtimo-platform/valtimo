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

package com.ritense.externalplugin.security

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpMethod
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.util.matcher.AntPathRequestMatcher
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Restricts external plugin service tokens (principal: [ExternalPluginServicePrincipal]) to a
 * hardcoded set of GZAC endpoints. Other authenticated principals (Keycloak users, etc.) are
 * unaffected.
 *
 * v12 §11.3 envisions a per-configuration allowlist table; for the PoC scope only the document
 * read endpoint is exposed.
 */
class ExternalPluginEndpointAllowlistFilter(
    private val allowedEndpoints: List<AntPathRequestMatcher> = DEFAULT_ALLOWLIST,
) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val authentication = SecurityContextHolder.getContext().authentication
        val principal = authentication?.principal
        if (principal !is ExternalPluginServicePrincipal) {
            filterChain.doFilter(request, response)
            return
        }

        val matched = allowedEndpoints.any { it.matches(request) }
        if (!matched) {
            response.sendError(
                HttpServletResponse.SC_FORBIDDEN,
                "Endpoint not allowed for external plugin service token",
            )
            return
        }

        filterChain.doFilter(request, response)
    }

    companion object {
        val DEFAULT_ALLOWLIST: List<AntPathRequestMatcher> = listOf(
            AntPathRequestMatcher("/api/v1/document/*", HttpMethod.GET.name()),
        )
    }
}
