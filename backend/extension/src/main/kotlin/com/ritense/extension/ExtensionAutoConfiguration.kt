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

package com.ritense.extension

import com.ritense.extension.web.rest.ExtensionManagementResource
import com.ritense.extension.web.rest.ExtensionSecurityConfigurer
import com.ritense.valtimo.contract.extension.ExtensionRegistrationListener
import org.pf4j.PluginStateListener
import org.pf4j.update.UpdateManager
import org.pf4j.update.UpdateRepository
import org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Lazy
import org.springframework.core.annotation.Order
import org.springframework.core.env.Environment
import org.springframework.core.io.support.ResourcePatternResolver
import kotlin.io.path.Path

@AutoConfiguration
class ExtensionAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(ExtensionManager::class)
    fun valtimoExtensionManager(
        resourceResolver: ResourcePatternResolver,
        environment: Environment,
    ): ExtensionManager {
        val valtimoExtensionPaths = if (environment.matchesProfiles("dev")) {
            listOf(Path(resourceResolver.getResource("classpath:/config").file.toPath().toString(), "extensions"))
        } else {
            listOf(Path("extensions"))
        }
        return ExtensionManager(
            valtimoExtensionPaths,
            resourceResolver,
        )
    }

    @Bean
    @ConditionalOnMissingBean(UpdateManager::class)
    fun valtimoExtensionUpdateManager(
        resourceResolver: ResourcePatternResolver,
        environment: Environment,
        valtimoExtensionManager: ExtensionManager,
        @Lazy repositories: List<UpdateRepository>
    ): ExtensionUpdateManager {
        val valtimoExtensionPath = if (environment.matchesProfiles("dev")) {
            Path(
                resourceResolver.getResource("classpath:/config").file.toPath().toString(),
                "extensions/repositories.json"
            )
        } else {
            Path("extensions/repositories.json")
        }
        return ExtensionUpdateManager(
            valtimoExtensionManager,
            valtimoExtensionPath,
            repositories,
        )
    }

    @Bean
    @ConditionalOnMissingBean(ExtensionManagementResource::class)
    fun extensionResource(
        valtimoExtensionUpdateManager: ExtensionUpdateManager,
    ): ExtensionManagementResource {
        return ExtensionManagementResource(
            valtimoExtensionUpdateManager
        )
    }

    @Bean
    @ConditionalOnMissingBean(ValtimoExtensionsInjector::class)
    fun valtimoExtensionsInjector(
        extensionManager: ExtensionManager,
        @Lazy extensionRegistrationListeners: List<ExtensionRegistrationListener>,
    ): ValtimoExtensionsInjector {
        return ValtimoExtensionsInjector(
            extensionManager,
            extensionRegistrationListeners,
        )
    }

    @Bean
    @ConditionalOnMissingBean(SpringBeanExtensionRegistrationListener::class)
    fun springBeanExtensionRegistrationListener(
        extensionManager: ExtensionManager,
        beanFactory: AbstractAutowireCapableBeanFactory,
    ): SpringBeanExtensionRegistrationListener {
        return SpringBeanExtensionRegistrationListener(
            extensionManager,
            beanFactory,
        )
    }

    @Bean
    @Order(270)
    @ConditionalOnMissingBean(ExtensionSecurityConfigurer::class)
    fun extensionSecurityConfigurer(): ExtensionSecurityConfigurer {
        return ExtensionSecurityConfigurer()
    }

    @Bean
    @ConditionalOnMissingBean(name = ["locallyPublishedExtensionsRepository"])
    fun locallyPublishedExtensionsRepository(): ExtensionRepository {
        return ExtensionRepository(
            "locally-published-extensions-repository",
            Path(System.getProperty("user.home"), ".valtimo_extensions").toUri().toURL()
        )
    }
}