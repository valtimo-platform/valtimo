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
import io.jsonwebtoken.Claims
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.Authentication

/**
 * Recognizes external plugin service tokens (HS256 JWTs with `type=external_plugin_service`) and
 * sets up Spring Security's `SecurityContext` with an `ExternalPluginServicePrincipal`.
 *
 * See [AbstractExternalPluginTokenFilter] for the shared recognition/pass-through mechanics.
 */
class ExternalPluginServiceTokenFilter(
    keyProvider: ExternalPluginServiceTokenKeyProvider,
    private val authenticator: ExternalPluginServiceTokenAuthenticator,
) : AbstractExternalPluginTokenFilter(keyProvider, ExternalPluginServiceTokenKeyProvider.TOKEN_TYPE) {

    override fun authenticate(token: String, claims: Claims): Authentication =
        authenticator.authenticate(token, claims)

    override fun continueAuthenticated(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        // Bypass PBAC for the duration of this request: the service token is the authorization,
        // and the URL surface is gated by ExternalPluginEndpointAllowlistFilter.
        AuthorizationContext.runWithoutAuthorization<Unit> {
            filterChain.doFilter(request, response)
        }
    }
}
