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

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockHttpServletRequest

class ExternalPluginAntPathRequestMatcherTest {

    @Test
    fun `double star in the middle of a pattern spans segments`() {
        val matcher = ExternalPluginAntPathRequestMatcher("/api/**/note", "GET")

        assertThat(matcher.matches(request("GET", "/api/note"))).isTrue()
        assertThat(matcher.matches(request("GET", "/api/v1/case/1/note"))).isTrue()
        assertThat(matcher.matches(request("GET", "/api/v1/case/1/notes"))).isFalse()
    }

    @Test
    fun `trailing double star matches the base path and everything below it`() {
        val matcher = ExternalPluginAntPathRequestMatcher("/api/v1/users/**", "POST")

        assertThat(matcher.matches(request("POST", "/api/v1/users"))).isTrue()
        assertThat(matcher.matches(request("POST", "/api/v1/users/1/activate"))).isTrue()
        assertThat(matcher.matches(request("POST", "/api/v1/usersx"))).isFalse()
    }

    @Test
    fun `single star and path variable match exactly one segment`() {
        listOf("/api/v1/document/*", "/api/v1/document/{id}").forEach { pattern ->
            val matcher = ExternalPluginAntPathRequestMatcher(pattern, "GET")

            assertThat(matcher.matches(request("GET", "/api/v1/document/123"))).isTrue()
            assertThat(matcher.matches(request("GET", "/api/v1/document/123/note"))).isFalse()
        }
    }

    @Test
    fun `repeated path variable names are allowed`() {
        val matcher = ExternalPluginAntPathRequestMatcher("/api/v1/case/{key}/note/{key}", "GET")

        assertThat(matcher.matches(request("GET", "/api/v1/case/1/note/2"))).isTrue()
    }

    @Test
    fun `http method must match when given`() {
        val matcher = ExternalPluginAntPathRequestMatcher("/api/v1/document/*", "GET")

        assertThat(matcher.matches(request("DELETE", "/api/v1/document/123"))).isFalse()
    }

    @Test
    fun `null or blank http method matches any method`() {
        listOf(null, "", " ").forEach { method ->
            val matcher = ExternalPluginAntPathRequestMatcher("/api/v1/document/*", method)

            assertThat(matcher.matches(request("DELETE", "/api/v1/document/123"))).isTrue()
        }
    }

    @Test
    fun `matching is case sensitive`() {
        val matcher = ExternalPluginAntPathRequestMatcher("/api/v1/external-plugin/**")

        assertThat(matcher.matches(request("GET", "/API/v1/external-plugin/host"))).isFalse()
    }

    @Test
    fun `matches servlet path plus path info`() {
        val matcher = ExternalPluginAntPathRequestMatcher("/api/operaton-rest/engine/**", "GET")
        val request = MockHttpServletRequest("GET", "/api/operaton-rest/engine/default").apply {
            servletPath = "/api/operaton-rest"
            pathInfo = "/engine/default"
        }

        assertThat(matcher.matches(request)).isTrue()
    }

    private fun request(method: String, path: String) =
        MockHttpServletRequest(method, path).apply { servletPath = path }
}
