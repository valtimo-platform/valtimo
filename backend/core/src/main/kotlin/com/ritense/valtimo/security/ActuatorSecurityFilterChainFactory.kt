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

package com.ritense.valtimo.security

import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ACTUATOR
import org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointProperties
import org.springframework.boot.actuate.autoconfigure.health.HealthEndpointProperties
import org.springframework.boot.actuate.autoconfigure.security.servlet.EndpointRequest
import org.springframework.http.HttpMethod
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.ProviderManager
import org.springframework.security.authentication.dao.DaoAuthenticationProvider
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.provisioning.InMemoryUserDetailsManager
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.util.matcher.AndRequestMatcher
import org.springframework.security.web.util.matcher.RequestMatcher

class ActuatorSecurityFilterChainFactory {

    @Deprecated("Will be removed in 13.0", ReplaceWith("createFilterChain(http, webEndpointProperties, healthEndpointProperties, passwordEncoder, username, password)"))
    fun createFilterChain(
        http: HttpSecurity,
        webEndpointProperties: WebEndpointProperties,
        passwordEncoder: PasswordEncoder,
        username: String,
        password: String
    ): SecurityFilterChain {
        return createFilterChain(http, webEndpointProperties, null, passwordEncoder, username, password)
    }

    @Suppress("UNUSED_PARAMETER")
    fun createFilterChain(
        http: HttpSecurity,
        webEndpointProperties: WebEndpointProperties,
        healthEndpointProperties: HealthEndpointProperties?,
        passwordEncoder: PasswordEncoder,
        username: String,
        password: String
    ): SecurityFilterChain {
        http
            .securityMatcher(EndpointRequest.toAnyEndpoint())
            .authorizeHttpRequests {
                // /health and /actuator (links) are always publicly readable; components and
                // details are stripped for non-actuator callers by ActuatorRoleHealthEndpointGroups.
                it.requestMatchers(EndpointRequest.to("health").withHttpMethod(HttpMethod.GET)).permitAll()
                // toLinks() has no withHttpMethod; AndRequestMatcher restricts it to GET.
                it.requestMatchers(AndRequestMatcher(getOnly, EndpointRequest.toLinks())).permitAll()
                // Only runtime mutation we expose: POST /loggers/{name}.
                it.requestMatchers(EndpointRequest.to("loggers").withHttpMethod(HttpMethod.POST)).hasAuthority(ACTUATOR)
                it.requestMatchers(EndpointRequest.toAnyEndpoint().withHttpMethod(HttpMethod.GET)).hasAuthority(ACTUATOR)
                // Defense in depth: any other write (POST /env, DELETE /caches, ...) lands here.
                it.anyRequest().denyAll()
            }
            .authenticationManager(actuatorAuthenticationManager(passwordEncoder, username, password))
            .httpBasic { it.realmName(ACTUATOR_REALM) }
            // CSRF off only for /loggers so automation can POST without first fetching a token.
            .csrf { it.ignoringRequestMatchers(EndpointRequest.to("loggers")) }

        return http.build()
    }

    private fun actuatorAuthenticationManager(
        passwordEncoder: PasswordEncoder,
        username: String,
        password: String
    ): AuthenticationManager {
        val userDetailsService: UserDetailsService = userDetailsService(passwordEncoder, username, password)
        val authenticationProvider = DaoAuthenticationProvider(userDetailsService)
        authenticationProvider.setPasswordEncoder(passwordEncoder)

        return ProviderManager(authenticationProvider)
    }

    private fun userDetailsService(
        passwordEncoder: PasswordEncoder,
        username: String,
        password: String
    ): UserDetailsService {
        val actuatorUser: UserDetails = User
            .withUsername(username)
            .password(passwordEncoder.encode(password))
            .authorities(ACTUATOR)
            .build()

        return InMemoryUserDetailsManager(actuatorUser)
    }

    companion object {
        const val ACTUATOR_REALM = "Actuator realm"

        private val getOnly = RequestMatcher { request -> request.method == "GET" }
    }
}