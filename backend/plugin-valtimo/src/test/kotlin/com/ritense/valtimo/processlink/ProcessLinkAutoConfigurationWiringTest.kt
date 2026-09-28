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

package com.ritense.valtimo.processlink

import com.ritense.valtimo.contract.plugin.PluginConfigurationMappingResolver
import com.ritense.valtimo.processlink.listener.ProcessLinkChangedEventListener
import com.ritense.valtimo.processlink.service.PluginConfigurationMappingResolverImpl
import java.lang.reflect.ParameterizedType
import java.lang.reflect.WildcardType
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean

/**
 * Multiple modules register a [PluginConfigurationMappingResolver] bean (this module's embedded
 * resolver and external-plugin's), and every real application has both modules on the classpath.
 * That cross-module wiring is not exercised by any single-module context test, so these contracts
 * are pinned by reflection:
 *
 * - the resolver bean's `@ConditionalOnMissingBean` must target its own concrete class — an
 *   interface-typed condition makes whichever module's configuration is processed first silently
 *   suppress the other module's resolver;
 * - every consumer that used to inject the single resolver must inject the full list — a
 *   single-valued injection point fails the application boot with a
 *   `NoUniqueBeanDefinitionException` once the second resolver exists.
 */
class ProcessLinkAutoConfigurationWiringTest {

    @Test
    fun `resolver bean condition targets its own concrete class, not the shared interface`() {
        val beanMethod = ProcessLinkAutoConfiguration::class.java.declaredMethods
            .single { it.name == "pluginConfigurationMappingResolver" }

        val condition = beanMethod.getAnnotation(ConditionalOnMissingBean::class.java)

        assertThat(condition).isNotNull
        assertThat(condition.value.map { it.java }).containsExactly(PluginConfigurationMappingResolverImpl::class.java)
    }

    @Test
    fun `process link changed event listener injects all mapping resolvers`() {
        val constructor = ProcessLinkChangedEventListener::class.java.constructors.single()
        val parameterType = constructor.genericParameterTypes.single()

        assertThat(parameterType).isInstanceOf(ParameterizedType::class.java)
        parameterType as ParameterizedType
        assertThat(parameterType.rawType).isEqualTo(List::class.java)
        // Kotlin's List<T> surfaces as List<? extends T> in Java reflection.
        val elementType = when (val argument = parameterType.actualTypeArguments.single()) {
            is WildcardType -> argument.upperBounds.single()
            else -> argument
        }
        assertThat(elementType).isEqualTo(PluginConfigurationMappingResolver::class.java)
    }
}
