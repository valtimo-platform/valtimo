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

package com.ritense.extension.config

import com.ritense.extension.ExtensionManager
import com.ritense.extension.model.ExtensionRegistrationListener
import com.ritense.extension.security.ExtensionSecurityConfigurer
import com.ritense.extension.web.rest.ExtensionResource
import com.ritense.valtimo.contract.config.LiquibaseMasterChangeLogLocation
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Bean
import org.springframework.core.Ordered.HIGHEST_PRECEDENCE
import org.springframework.core.annotation.Order
import org.springframework.core.io.support.ResourcePatternResolver
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import javax.sql.DataSource
import kotlin.io.path.Path

@EnableJpaRepositories(basePackages = ["com.ritense.extension.repository"])
@EntityScan("com.ritense.extension.domain")
@AutoConfiguration
class ExtensionAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(ExtensionManager::class)
    fun extensionManager(
        resourcePatternResolver: ResourcePatternResolver,
        extensionRegistrationListeners: List<ExtensionRegistrationListener>
    ): ExtensionManager {
        return ExtensionManager(
            Path(resourcePatternResolver.getResource("classpath:/config").file.toPath().toString(), "extensions"),
            extensionRegistrationListeners,
        )
    }

    @Bean
    @ConditionalOnMissingBean(ExtensionResource::class)
    fun extensionResource(
        extensionManager: ExtensionManager
    ): ExtensionResource {
        return ExtensionResource(
            extensionManager
        )
    }

    @Bean
    @Order(270)
    @ConditionalOnMissingBean(ExtensionSecurityConfigurer::class)
    fun extensionSecurityConfigurer(): ExtensionSecurityConfigurer {
        return ExtensionSecurityConfigurer()
    }

    @ConditionalOnClass(DataSource::class)
    @Order(HIGHEST_PRECEDENCE + 32)
    @Bean
    fun extensionLiquibaseChangeLogLocation(): LiquibaseMasterChangeLogLocation {
        return LiquibaseMasterChangeLogLocation("config/liquibase/extension-master.xml")
    }
}