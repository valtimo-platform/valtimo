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

package com.ritense.exchange.web

import com.ritense.exchange.config.ExchangeAutoConfiguration
import com.ritense.exchange.security.ExchangeHttpSecurityConfigurer
import com.ritense.exporter.manifest.ValtimoVersionResolver
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Import
import org.springframework.security.config.Customizer
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.web.servlet.config.annotation.EnableWebMvc

@Configuration
@EnableWebMvc
@EnableWebSecurity
@Import(ExchangeAutoConfiguration::class)
class ExchangeTestConfig {

    @Bean
    fun valtimoVersionResolver() = ValtimoVersionResolver { "13.53.0" }

    @Bean
    fun securityFilterChain(http: HttpSecurity, configurer: ExchangeHttpSecurityConfigurer): SecurityFilterChain {
        configurer.configure(http)
        return http
            .csrf { it.disable() }
            .authorizeHttpRequests { it.anyRequest().denyAll() }
            .httpBasic(Customizer.withDefaults())
            .build()
    }
}
