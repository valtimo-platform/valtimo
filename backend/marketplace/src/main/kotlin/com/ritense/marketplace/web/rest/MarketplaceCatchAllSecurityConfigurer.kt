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

package com.ritense.marketplace.web.rest

import com.ritense.valtimo.contract.security.config.HttpConfigurerConfigurationException
import com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.util.matcher.AntPathRequestMatcher.antMatcher

/**
 * A last-resort `anyRequest().permitAll()` for the host security chain.
 *
 * Runtime-loaded packages register their endpoints (and their own
 * HttpSecurityConfigurer beans) AFTER the security filter chain has already been
 * built, so those rules never take effect and the package's endpoints fall
 * through to the chain's default-deny — a 403 even for authenticated admins.
 *
 * Because the marketplace mechanism is explicitly out of scope for security (see the
 * plan / valtimo.marketplace.enforceWhitelist), this configurer is applied LAST
 * (Ordered.LOWEST_PRECEDENCE, wired in MarketplaceAutoConfiguration) and permits any
 * request not already matched by a host configurer. Host endpoints keep their own
 * rules (they're matched earlier); only otherwise-unmatched requests — package
 * endpoints — become reachable. Disable with valtimo.marketplace.enforceWhitelist=true.
 */
class MarketplaceCatchAllSecurityConfigurer : HttpSecurityConfigurer {

    override fun configure(http: HttpSecurity) {
        try {
            // Use a "/**" matcher rather than anyRequest(): the host chain already
            // declares anyRequest() and configuring it twice throws. Applied last,
            // this matches only requests no earlier (host) rule claimed.
            http.authorizeHttpRequests { requests ->
                requests.requestMatchers(antMatcher("/**")).permitAll()
            }
        } catch (e: Exception) {
            throw HttpConfigurerConfigurationException(e)
        }
    }
}