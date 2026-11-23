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

import com.ritense.valtimo.contract.security.matcher.SecurityRequestMatchers.antMatcher
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod.GET
import org.springframework.http.HttpMethod.POST
import org.springframework.mock.web.MockHttpServletRequest

class SecurityRequestMatchersTest {

    @Test
    fun `matches exact path and method`() {
        val matcher = antMatcher(GET, "/api/v1/case")

        assertThat(matcher.matches(request("GET", "/api/v1/case"))).isTrue()
        assertThat(matcher.matches(request("POST", "/api/v1/case"))).isFalse()
        assertThat(matcher.matches(request("GET", "/api/v1/case/"))).isFalse()
        assertThat(matcher.matches(request("GET", "/api/v1/Case"))).isFalse()
    }

    @Test
    fun `matches any method when none is given`() {
        val matcher = antMatcher("/api/v1/case")

        assertThat(matcher.matches(request("GET", "/api/v1/case"))).isTrue()
        assertThat(matcher.matches(request("DELETE", "/api/v1/case"))).isTrue()
    }

    @Test
    fun `path variable and single star match exactly one segment`() {
        val variable = antMatcher(GET, "/api/v1/case/{id}")
        val star = antMatcher(GET, "/api/v1/case/*")

        listOf(variable, star).forEach { matcher ->
            assertThat(matcher.matches(request("GET", "/api/v1/case/a.b@c.nl"))).isTrue()
            assertThat(matcher.matches(request("GET", "/api/v1/case/123/note"))).isFalse()
            assertThat(matcher.matches(request("GET", "/api/v1/case"))).isFalse()
        }
    }

    @Test
    fun `trailing double star matches the base path and everything below it`() {
        val matcher = antMatcher(POST, "/api/v1/case/**")

        assertThat(matcher.matches(request("POST", "/api/v1/case"))).isTrue()
        assertThat(matcher.matches(request("POST", "/api/v1/case/1/note/2"))).isTrue()
        assertThat(matcher.matches(request("POST", "/api/v1/cases"))).isFalse()
    }

    @Test
    fun `matches the path below the context path`() {
        val matcher = antMatcher(GET, "/api/v1/case")
        val request = request("GET", "/valtimo/api/v1/case").apply { contextPath = "/valtimo" }

        assertThat(matcher.matches(request)).isTrue()
    }

    @Test
    fun `rejects patterns PathPattern cannot parse`() {
        assertThatThrownBy { antMatcher(GET, "/api/**/case") }
            .isInstanceOf(IllegalArgumentException::class.java)
        assertThatThrownBy { antMatcher(GET, "/api/v1/case/{key}/note/{key}") }
            .isInstanceOf(IllegalArgumentException::class.java)
        assertThatThrownBy { antMatcher(GET, "api/v1/case") }
            .isInstanceOf(IllegalArgumentException::class.java)
    }

    private fun request(method: String, uri: String) = MockHttpServletRequest(method, uri)
}
