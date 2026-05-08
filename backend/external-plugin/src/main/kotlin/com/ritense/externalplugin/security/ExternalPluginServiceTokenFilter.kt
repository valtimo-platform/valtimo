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

import com.ritense.authorization.AuthorizationContext
import io.github.oshai.kotlinlogging.KotlinLogging
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.SignatureAlgorithm
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.OncePerRequestFilter
import java.util.Collections
import java.util.Enumeration

/**
 * Recognizes external plugin service tokens (HS256 JWTs with `type=external_plugin_service`) and
 * sets up Spring Security's `SecurityContext` with an `ExternalPluginServicePrincipal`.
 *
 * Runs **before** Spring Security's `BearerTokenAuthenticationFilter`. When our token is detected
 * and validated, the request is wrapped so the `Authorization` header is hidden from downstream
 * filters — otherwise `BearerTokenAuthenticationFilter` would try to validate the same token
 * against Keycloak's JWKS and reject it.
 *
 * Tokens that don't match our signing key are silently passed through; the OAuth2 resource-server
 * filter chain handles them as before.
 */
class ExternalPluginServiceTokenFilter(
    keyProvider: ExternalPluginServiceTokenKeyProvider,
    private val authenticator: ExternalPluginServiceTokenAuthenticator,
) : OncePerRequestFilter() {

    private val parser = Jwts.parser()
        .setSigningKey(keyProvider.getKey(SignatureAlgorithm.HS256))
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
            parser.parseClaimsJws(token).body
        } catch (_: JwtException) {
            // Either not our token (signed with another key/algorithm) or invalid. Either way,
            // let the downstream filter chain handle it.
            filterChain.doFilter(request, response)
            return
        }

        val typeClaim = claims.get(ExternalPluginServiceTokenKeyProvider.TYPE_CLAIM, String::class.java)
        if (typeClaim != ExternalPluginServiceTokenKeyProvider.TOKEN_TYPE) {
            filterChain.doFilter(request, response)
            return
        }

        try {
            val authentication = authenticator.authenticate(token, claims)
            SecurityContextHolder.getContext().authentication = authentication
            kLogger.debug { "Authenticated external plugin service token for ${authentication.principal}" }
        } catch (e: Exception) {
            kLogger.warn(e) { "Failed to authenticate external plugin service token" }
            filterChain.doFilter(request, response)
            return
        }

        // Bypass PBAC for the duration of this request: the service token is the authorization,
        // and the URL surface is gated by ExternalPluginEndpointAllowlistFilter.
        AuthorizationContext.runWithoutAuthorization<Unit> {
            filterChain.doFilter(AuthorizationStrippingRequestWrapper(request), response)
        }
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
