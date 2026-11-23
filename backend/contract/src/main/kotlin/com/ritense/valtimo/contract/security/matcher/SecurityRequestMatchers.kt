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

package com.ritense.valtimo.contract.security.matcher

import org.springframework.http.HttpMethod
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher
import org.springframework.security.web.util.matcher.RequestMatcher

/**
 * Drop-in for `AntPathRequestMatcher.antMatcher`, which Spring Security 7 removes. Backed by
 * [PathPatternRequestMatcher], so patterns follow `PathPattern` syntax: `**` only at the end.
 */
object SecurityRequestMatchers {

    private val builder = PathPatternRequestMatcher.withDefaults()

    @JvmStatic
    fun antMatcher(method: HttpMethod?, pattern: String): RequestMatcher = builder.matcher(method, pattern)

    @JvmStatic
    fun antMatcher(pattern: String): RequestMatcher = builder.matcher(pattern)
}
