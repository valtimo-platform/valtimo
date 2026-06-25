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

import io.github.oshai.kotlinlogging.KotlinLogging
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.OncePerRequestFilter
import java.util.Collections
import java.util.Enumeration

/**
 * Recognizes external plugin **user** tokens (HS256 JWTs with `type=external_plugin_user`) and sets
 * up Spring Security's `SecurityContext` with an [ExternalPluginUserPrincipal].
 *
 * Mirrors [ExternalPluginServiceTokenFilter] with one critical divergence: it does **not**
 * `runWithoutAuthorization`. The user token is *not* a system credential — it carries the user's real
 * identity and roles so PBAC runs normally. Reach is intersected with the plugin's granted endpoints
 * by [ExternalPluginEndpointAllowlistFilter] (which also recognises the user principal).
 *
 * Tokens that don't match our signing key / type are silently passed through to the OAuth2
 * resource-server chain. On a match the request is wrapped so the `Authorization` header is hidden
 * from `BearerTokenAuthenticationFilter`, which would otherwise reject our token against Keycloak's
 * JWKS.
 */
class ExternalPluginUserTokenFilter(
    keyProvider: ExternalPluginUserTokenKeyProvider,
    private val authenticator: ExternalPluginUserTokenAuthenticator,
) : OncePerRequestFilter() {

    private val parser = Jwts.parser()
        .verifyWith(keyProvider.signingKey)
        .build()

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val authHeader = request.getHeader("Authorization")
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response)
            return
        }

        val token = authHeader.removePrefix("Bearer ").trim()
        val claims = try {
            parser.parseSignedClaims(token).payload
        } catch (_: JwtException) {
            // Either not our token (signed with another key/algorithm) or invalid. Either way,
            // let the downstream filter chain handle it.
            filterChain.doFilter(request, response)
            return
        }

        val typeClaim = claims.get(ExternalPluginUserTokenKeyProvider.TYPE_CLAIM, String::class.java)
        if (typeClaim != ExternalPluginUserTokenKeyProvider.TOKEN_TYPE) {
            filterChain.doFilter(request, response)
            return
        }

        try {
            val authentication = authenticator.authenticate(token, claims)
            SecurityContextHolder.getContext().authentication = authentication
            kLogger.debug { "Authenticated external plugin user token for ${authentication.name}" }
        } catch (e: Exception) {
            kLogger.warn(e) { "Failed to authenticate external plugin user token" }
            filterChain.doFilter(request, response)
            return
        }

        // NOTE: no runWithoutAuthorization here — PBAC must stay active for the user token.
        filterChain.doFilter(AuthorizationStrippingRequestWrapper(request), response)
    }

    /**
     * Hides the `Authorization` header from downstream filters so Spring Security's
     * `BearerTokenAuthenticationFilter` does not try to re-authenticate the token.
     */
    private class AuthorizationStrippingRequestWrapper(request: HttpServletRequest) :
        HttpServletRequestWrapper(request) {
        override fun getHeader(name: String): String? =
            if (name.equals("Authorization", ignoreCase = true)) null else super.getHeader(name)

        override fun getHeaders(name: String): Enumeration<String> =
            if (name.equals("Authorization", ignoreCase = true)) {
                Collections.emptyEnumeration()
            } else super.getHeaders(name)

        override fun getHeaderNames(): Enumeration<String> {
            val names = super.getHeaderNames().toList().filter { !it.equals("Authorization", ignoreCase = true) }
            return Collections.enumeration(names)
        }
    }

    companion object {
        private val kLogger = KotlinLogging.logger {}
    }
}
