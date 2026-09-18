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

import com.ritense.externalplugin.autoconfigure.ExternalPluginAutoConfiguration
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.core.annotation.AnnotationUtils
import org.mockito.kotlin.mock
import org.springframework.core.annotation.Order
import kotlin.reflect.jvm.javaMethod

/**
 * Two structural guarantees of the plugin filter wiring that no functional test would
 * notice breaking:
 *
 * 1. Each plugin filter is a Spring bean *and* a servlet filter, so Boot's servlet auto-registration
 *    would run it a second time outside the Spring Security chain — on **every** request, including
 *    ones the security chain never reaches. The autoconfiguration therefore publishes a disabled
 *    `FilterRegistrationBean` for each. Losing `isEnabled = false` would double-execute the
 *    Authorization-header stripping and the allowlist gate against a request that has no principal.
 * 2. The callback configurer must be ordered **before** the platform's `BearerTokenAuthenticationFilter`
 *    (@Order 450) or a plugin token would be handed to the Keycloak resolver first and rejected.
 */
class ExternalPluginFilterRegistrationTest {

    private val registrationBeanMethods = listOf(
        ExternalPluginAutoConfiguration::externalPluginServiceTokenFilterRegistration,
        ExternalPluginAutoConfiguration::externalPluginUserTokenFilterRegistration,
        ExternalPluginAutoConfiguration::externalPluginEndpointAllowlistFilterRegistration,
    )

    @Test
    fun `every plugin filter has a registration bean, so none is silently left auto-registered`() {
        // Three filters exist (service token, user token, allowlist); each needs its own opt-out.
        assertThat(registrationBeanMethods).hasSize(3)
        registrationBeanMethods.forEach { method ->
            assertThat(method.javaMethod!!.returnType).isEqualTo(FilterRegistrationBean::class.java)
        }
    }

    @Test
    fun `the service-token filter is not auto-registered as a bare servlet filter`() {
        val registration = ExternalPluginAutoConfiguration::externalPluginServiceTokenFilterRegistration
        val filter = ExternalPluginServiceTokenFilter(ExternalPluginServiceTokenKeyProvider(SECRET), mock())

        assertThat(registration.call(autoConfiguration(), filter).isEnabled).isFalse()
    }

    @Test
    fun `the user-token filter is not auto-registered as a bare servlet filter`() {
        val registration = ExternalPluginAutoConfiguration::externalPluginUserTokenFilterRegistration
        val filter = ExternalPluginUserTokenFilter(ExternalPluginUserTokenKeyProvider(SECRET), mock())

        assertThat(registration.call(autoConfiguration(), filter).isEnabled).isFalse()
    }

    @Test
    fun `the allowlist filter is not auto-registered as a bare servlet filter`() {
        val registration = ExternalPluginAutoConfiguration::externalPluginEndpointAllowlistFilterRegistration
        val filter = ExternalPluginEndpointAllowlistFilter(mock())

        assertThat(registration.call(autoConfiguration(), filter).isEnabled).isFalse()
    }

    @Test
    fun `the callback security configurer runs before the platform bearer-token filter`() {
        val method = ExternalPluginAutoConfiguration::class.java.methods
            .single { it.name == "externalPluginCallbackHttpSecurityConfigurer" }

        val order = AnnotationUtils.findAnnotation(method, Order::class.java)

        assertThat(order).isNotNull()
        // 450 places the chain ahead of BearerTokenAuthenticationFilter; a larger value would let
        // Keycloak's resolver see (and reject) a plugin token first.
        assertThat(order!!.value).isEqualTo(450)
    }

    private fun autoConfiguration() = ExternalPluginAutoConfiguration()

    private companion object {
        /** Any 32+ byte secret: the key providers derive an HmacSHA256 key by hashing it. */
        const val SECRET = "test-encryption-secret-value-1234"
    }
}
