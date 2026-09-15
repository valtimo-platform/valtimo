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

package com.valtimo.keycloak.security.config

import com.ritense.valtimo.contract.security.config.SelfAuthenticatingEndpoints
import jakarta.servlet.http.HttpServletRequest
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver
import org.springframework.security.web.util.matcher.OrRequestMatcher
import org.springframework.security.web.util.matcher.RequestMatcher

class SelfAuthenticatingEndpointBearerTokenResolver(
    selfAuthenticatingEndpoints: List<SelfAuthenticatingEndpoints>,
    private val delegate: BearerTokenResolver = DefaultBearerTokenResolver()
) : BearerTokenResolver {

    private val matcher: RequestMatcher? = selfAuthenticatingEndpoints
        .flatMap { it.selfAuthenticatingEndpoints }
        .takeIf { it.isNotEmpty() }
        ?.let { OrRequestMatcher(it) }

    override fun resolve(request: HttpServletRequest): String? {
        return if (matcher?.matches(request) == true) null else delegate.resolve(request)
    }
}
