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
import io.jsonwebtoken.Claims
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.Authentication
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.OncePerRequestFilter
import java.util.Collections
import java.util.Enumeration

/**
 * Template for the external-plugin token filters. Recognizes HS256 JWTs signed with this filter's
 * key and carrying the expected `type` claim, and sets up Spring Security's `SecurityContext` with
 * the principal produced by [authenticate].
 *
 * Runs **before** Spring Security's `BearerTokenAuthenticationFilter`. When our token is detected
 * and validated, the request is wrapped so the `Authorization` header is hidden from downstream
 * filters — otherwise `BearerTokenAuthenticationFilter` would try to validate the same token
 * against Keycloak's JWKS and reject it.
 *
 * Tokens that don't match our signing key / type are silently passed through; the OAuth2
 * resource-server filter chain handles them as before.
 */
abstract class AbstractExternalPluginTokenFilter(
    keyProvider: ExternalPluginTokenKeyProvider,
    private val expectedTokenType: String,
) : OncePerRequestFilter() {

    private val parser = Jwts.parser()
        .verifyWith(keyProvider.signingKey)
        .build()

    final override fun doFilterInternal(
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

        val typeClaim = claims.get(ExternalPluginTokenKeyProvider.TYPE_CLAIM, String::class.java)
        if (typeClaim != expectedTokenType) {
            filterChain.doFilter(request, response)
            return
        }

        try {
            val authentication = authenticate(token, claims)
            SecurityContextHolder.getContext().authentication = authentication
            kLogger.debug { "Authenticated external plugin token ($expectedTokenType) for ${authentication.name}" }
        } catch (e: Exception) {
            kLogger.warn(e) { "Failed to authenticate external plugin token ($expectedTokenType)" }
            filterChain.doFilter(request, response)
            return
        }

        continueAuthenticated(AuthorizationStrippingRequestWrapper(request), response, filterChain)
    }

    /** Turns a validated token into an [Authentication]; may throw to reject the token. */
    protected abstract fun authenticate(token: String, claims: Claims): Authentication

    /**
     * Continues the filter chain after successful authentication. The request already hides the
     * `Authorization` header. Subclasses decide whether PBAC stays active for the request.
     */
    protected abstract fun continueAuthenticated(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    )

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
