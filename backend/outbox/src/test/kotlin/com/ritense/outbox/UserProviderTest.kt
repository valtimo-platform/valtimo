/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.outbox

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.security.authentication.TestingAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder

class UserProviderTest {

    private val userProvider = UserProvider()

    @AfterEach
    fun tearDown() {
        SecurityContextHolder.clearContext()
    }

    @Test
    fun `getCurrentUserLogin should return username when authenticated`() {
        SecurityContextHolder.getContext().authentication =
            TestingAuthenticationToken("john@example.com", null)

        assertThat(userProvider.getCurrentUserLogin()).isEqualTo("john@example.com")
    }

    @Test
    fun `getCurrentUserLogin should return null when no authentication`() {
        assertThat(userProvider.getCurrentUserLogin()).isNull()
    }

    @Test
    fun `getCurrentUserRoles should return authorities when authenticated`() {
        SecurityContextHolder.getContext().authentication =
            TestingAuthenticationToken("user", null, listOf(
                SimpleGrantedAuthority("ROLE_ADMIN"),
                SimpleGrantedAuthority("ROLE_USER")
            ))

        assertThat(userProvider.getCurrentUserRoles())
            .containsExactly("ROLE_ADMIN", "ROLE_USER")
    }

    @Test
    fun `getCurrentUserRoles should return empty list when no authentication`() {
        assertThat(userProvider.getCurrentUserRoles()).isEmpty()
    }

    @Test
    fun `getCurrentUserRoles should return empty list when no authorities`() {
        SecurityContextHolder.getContext().authentication =
            TestingAuthenticationToken("user", null, emptyList())

        assertThat(userProvider.getCurrentUserRoles()).isEmpty()
    }
}
