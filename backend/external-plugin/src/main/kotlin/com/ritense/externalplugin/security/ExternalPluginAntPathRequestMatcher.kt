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

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpMethod
import org.springframework.security.web.util.matcher.RequestMatcher
import org.springframework.util.AntPathMatcher

/**
 * Ant-style matcher for plugin-declared endpoint patterns. Manifests are documented as Ant-style
 * (`**` anywhere) and plugin-host mirrors these semantics, so `PathPattern` is not a drop-in here.
 * Same behaviour as Spring Security's removed `AntPathRequestMatcher`: case-sensitive, matched
 * against servlet path plus path info.
 */
class ExternalPluginAntPathRequestMatcher(
    val pattern: String,
    httpMethod: String? = null,
) : RequestMatcher {

    private val httpMethod: HttpMethod? = httpMethod?.takeIf { it.isNotBlank() }?.let { HttpMethod.valueOf(it) }

    override fun matches(request: HttpServletRequest): Boolean {
        if (httpMethod != null && !request.method.isNullOrEmpty() && httpMethod != HttpMethod.valueOf(request.method)) {
            return false
        }
        return PATH_MATCHER.match(pattern, requestPath(request))
    }

    override fun toString(): String = "Ant [pattern='$pattern'${httpMethod?.let { ", $it" } ?: ""}]"

    private fun requestPath(request: HttpServletRequest): String =
        request.servletPath + (request.pathInfo ?: "")

    companion object {
        private val PATH_MATCHER = AntPathMatcher().apply { setTrimTokens(false) }
    }
}
