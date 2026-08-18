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

import com.ritense.externalplugin.repository.ExternalPluginGrantedEndpointRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.util.matcher.AntPathRequestMatcher
import org.springframework.web.filter.OncePerRequestFilter
import java.time.Duration
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Restricts external plugin tokens to the endpoints that were explicitly granted for the plugin
 * configuration. Applies to **both** token kinds:
 *
 * - [ExternalPluginServicePrincipal] — the host's system credential. Reach is *only* the allowlist
 *   (PBAC is bypassed for the service token).
 * - [ExternalPluginUserPrincipal] — the downscoped user token used by the iframe parent-proxy. Reach
 *   is **PBAC ∩ allowlist**: PBAC is enforced upstream (the recognising filter does not run without
 *   authorization) and this filter narrows it further to the granted set.
 *
 * Other authenticated principals (interactive Keycloak users, etc.) are unaffected.
 *
 * On top of the grants, a hard denylist ([DENYLIST_PATTERNS]) shields sensitive surfaces — external-
 * plugin management (incl. host registration), user-token minting and role/permission management —
 * from plugin tokens **regardless of what was granted**. One narrow exception: a **user** token may
 * always `GET` the user-token introspection endpoint, which the plugin host needs to validate the
 * token before executing Wasm (see the carve-out in [doFilterInternal]).
 *
 * Granted endpoints are compiled into request matchers and cached per configuration id for a short
 * TTL so the per-request cost is a map lookup instead of a DB query. An invalid stored pattern is
 * skipped with a warning (deny unless another grant matches) rather than failing the request.
 */
class ExternalPluginEndpointAllowlistFilter(
    private val grantedEndpointRepository: ExternalPluginGrantedEndpointRepository,
    private val cacheTtl: Duration = Duration.ofSeconds(30),
) : OncePerRequestFilter() {

    private val matcherCache = ConcurrentHashMap<UUID, CachedMatchers>()

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val authentication = SecurityContextHolder.getContext().authentication
        val principal = authentication?.principal
        val configurationId = when (principal) {
            is ExternalPluginServicePrincipal -> principal.pluginConfigId
            is ExternalPluginUserPrincipal -> principal.pluginConfigId
            else -> {
                filterChain.doFilter(request, response)
                return
            }
        }

        // Carve-out: a USER token may always introspect itself, regardless of denylist and grants.
        // The plugin host must introspect user tokens against GZAC before executing Wasm for its
        // public /data route, and the only credential it holds for that is the token itself. The
        // endpoint is read-only (exact path, GET only) and leaks nothing beyond the token's own
        // claims. Service-token principals get no carve-out — introspection is meaningless for them.
        if (principal is ExternalPluginUserPrincipal && USER_TOKEN_INTROSPECT_MATCHER.matches(request)) {
            filterChain.doFilter(request, response)
            return
        }

        // Hard denylist: sensitive surfaces are unreachable for plugin tokens regardless of grants.
        if (DENYLIST_MATCHERS.any { it.matches(request) }) {
            response.sendError(
                HttpServletResponse.SC_FORBIDDEN,
                "External plugins cannot access this endpoint",
            )
            return
        }

        val matched = grantedMatchers(configurationId).any { matcher ->
            try {
                matcher.matches(request)
            } catch (e: Exception) {
                kLogger.warn(e) {
                    "Granted endpoint pattern '${matcher.pattern}' for configuration $configurationId " +
                        "failed to match; treating as not matched"
                }
                false
            }
        }
        if (!matched) {
            response.sendError(
                HttpServletResponse.SC_FORBIDDEN,
                "Endpoint not allowed for external plugin service token",
            )
            return
        }

        filterChain.doFilter(request, response)
    }

    private fun grantedMatchers(configurationId: UUID): List<AntPathRequestMatcher> {
        val cached = matcherCache[configurationId]
        val now = System.currentTimeMillis()
        if (cached != null && cached.expiresAtMillis > now) {
            return cached.matchers
        }
        val matchers = grantedEndpointRepository.findAllByConfigurationId(configurationId)
            .mapNotNull { granted ->
                try {
                    AntPathRequestMatcher(granted.endpointPattern, granted.httpMethod)
                } catch (e: Exception) {
                    // Patterns are validated at grant time, so this only fires for legacy/corrupt
                    // rows. Deny (skip) instead of failing the whole request with a 500.
                    kLogger.warn(e) {
                        "Invalid granted endpoint pattern '${granted.endpointPattern}' for " +
                            "configuration $configurationId; ignoring this grant"
                    }
                    null
                }
            }
        matcherCache[configurationId] = CachedMatchers(now + cacheTtl.toMillis(), matchers)
        return matchers
    }

    private class CachedMatchers(
        val expiresAtMillis: Long,
        val matchers: List<AntPathRequestMatcher>,
    )

    companion object {
        /**
         * Surfaces plugin tokens must never reach, regardless of grants:
         * - external-plugin management (host registration, config/grant administration, uploads);
         * - user-token minting (a plugin must not mint tokens for arbitrary users);
         * - role and permission management (privilege escalation).
         */
        val DENYLIST_PATTERNS: List<String> = listOf(
            "/api/management/v1/external-plugin/**",
            "/api/v1/external-plugin/**",
            "/api/management/v1/roles/**",
            "/api/management/v1/permissions/**",
        )

        private val DENYLIST_MATCHERS = DENYLIST_PATTERNS.map { AntPathRequestMatcher(it) }

        /** Exact-path, GET-only carve-out for user-token introspection (see [doFilterInternal]). */
        private val USER_TOKEN_INTROSPECT_MATCHER =
            AntPathRequestMatcher("/api/v1/external-plugin/user-token/introspect", "GET")

        private val kLogger = KotlinLogging.logger {}
    }
}
