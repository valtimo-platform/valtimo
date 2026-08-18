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

import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.userdetails.UserDetails
import java.util.UUID

/**
 * Spring Security principal for an external-plugin **user** token. Resolves to the real logged-in
 * user (so PBAC conditions referencing the current user behave exactly as they would for a Keycloak
 * session) and additionally carries the [pluginConfigId] that [ExternalPluginEndpointAllowlistFilter]
 * uses to intersect the user's reach with the plugin configuration's granted endpoints.
 *
 * Implements [UserDetails] so `Authentication.getName()` resolves to the user login via
 * [getUsername] — which is what `SecurityUtils.getCurrentUserLogin()` reads.
 *
 * Deliberately **not** a `SystemPrincipal`: the whole point of the user token is that the work is
 * attributed to, and authorized for, the actual user.
 */
data class ExternalPluginUserPrincipal(
    val userLogin: String,
    val roles: List<String>,
    val pluginConfigId: UUID,
) : UserDetails {

    override fun getAuthorities(): Collection<GrantedAuthority> = roles.map { SimpleGrantedAuthority(it) }

    override fun getPassword(): String? = null

    override fun getUsername(): String = userLogin

    override fun isAccountNonExpired(): Boolean = true

    override fun isAccountNonLocked(): Boolean = true

    override fun isCredentialsNonExpired(): Boolean = true

    override fun isEnabled(): Boolean = true

    override fun toString(): String = "external-plugin-user:$userLogin:$pluginConfigId"
}
