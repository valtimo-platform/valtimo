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

package com.ritense.externalplugin.autoconfigure

import com.ritense.externalplugin.BaseIntegrationTest
import com.ritense.externalplugin.service.ExternalPluginConfigurationMappingResolver
import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import com.ritense.valtimo.processlink.listener.ProcessLinkChangedEventListener
import com.ritense.valtimo.processlink.service.PluginConfigurationMappingResolverImpl
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationContext

/**
 * Boots a Spring context combining `plugin-valtimo` and `external-plugin` on the same classpath —
 * every real application does, since `valtimo-dependencies` pulls in both as `api` deps. Regresses
 * two historical bean-registration bugs found in this codebase:
 *
 * - `ProcessLinkAutoConfiguration.processLinkChangedEventListener` used to take a single-value
 *   [PluginConfigurationMappingResolver] constructor parameter, which fails context refresh with a
 *   `NoUniqueBeanDefinitionException` once both [PluginConfigurationMappingResolverImpl] and
 *   [ExternalPluginConfigurationMappingResolver] are registered beans of that interface.
 * - `ProcessLinkAutoConfiguration.pluginConfigurationMappingResolver` used to carry
 *   `@ConditionalOnMissingBean(PluginConfigurationMappingResolver::class)` (the shared interface)
 *   instead of its own concrete class, which silently suppresses whichever of the two resolver
 *   beans loses the `@Configuration` class processing order race — no boot failure, just one
 *   resolver family quietly never running.
 */
class DualPluginConfigurationMappingResolverIntTest @Autowired constructor(
    private val applicationContext: ApplicationContext,
) : BaseIntegrationTest() {

    @Test
    fun `context contains exactly two PluginConfigurationMappingResolver beans`() {
        val resolvers = applicationContext.getBeansOfType(PluginConfigurationMappingResolver::class.java)

        assertThat(resolvers).hasSize(2)
        assertThat(resolvers.values).hasAtLeastOneElementOfType(PluginConfigurationMappingResolverImpl::class.java)
        assertThat(resolvers.values).hasAtLeastOneElementOfType(ExternalPluginConfigurationMappingResolver::class.java)
    }

    @Test
    fun `ProcessLinkChangedEventListener bean is present with both resolvers injected`() {
        val listeners = applicationContext.getBeansOfType(ProcessLinkChangedEventListener::class.java)

        assertThat(listeners).hasSize(1)
    }
}
