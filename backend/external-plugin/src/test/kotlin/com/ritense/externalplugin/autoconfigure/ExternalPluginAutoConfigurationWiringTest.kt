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

import com.ritense.externalplugin.service.ExternalPluginConfigurationMappingResolver
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean

/**
 * The embedded plugin system registers its own `PluginConfigurationMappingResolver` bean next to
 * this module's, and every real application has both modules on the classpath. An interface-typed
 * `@ConditionalOnMissingBean` would make whichever module's configuration is processed first
 * silently suppress the other resolver, so the condition must target this module's concrete class.
 * No single-module context test exercises that cross-module combination — pinned by reflection.
 */
class ExternalPluginAutoConfigurationWiringTest {

    @Test
    fun `resolver bean condition targets its own concrete class, not the shared interface`() {
        val beanMethod = ExternalPluginAutoConfiguration::class.java.declaredMethods
            .single { it.name == "externalPluginConfigurationMappingResolver" }

        val condition = beanMethod.getAnnotation(ConditionalOnMissingBean::class.java)

        assertThat(condition).isNotNull
        assertThat(condition.value.map { it.java })
            .containsExactly(ExternalPluginConfigurationMappingResolver::class.java)
    }
}
