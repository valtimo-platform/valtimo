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

package com.ritense.adminsettings.autoconfigure

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.adminsettings.importer.AdminSettingsAccentColorsImporter
import com.ritense.adminsettings.importer.AdminSettingsFeatureToggleImporter
import com.ritense.adminsettings.importer.AdminSettingsLogoImporter
import com.ritense.adminsettings.repository.AccentColorsRepository
import com.ritense.adminsettings.repository.AdminSettingsLogoRepository
import com.ritense.adminsettings.repository.FeatureToggleOverridesRepository
import com.ritense.adminsettings.repository.MenuConfigurationRepository
import com.ritense.adminsettings.security.config.AdminSettingsHttpSecurityConfigurer
import com.ritense.adminsettings.service.AccentColorsService
import com.ritense.adminsettings.service.AdminSettingsLogoService
import com.ritense.adminsettings.service.FeatureToggleOverridesService
import com.ritense.adminsettings.service.MenuConfigurationService
import com.ritense.adminsettings.web.rest.AccentColorsResource
import com.ritense.adminsettings.web.rest.AdminSettingsLogoResource
import com.ritense.adminsettings.web.rest.FeatureToggleOverridesResource
import com.ritense.adminsettings.web.rest.MenuConfigurationResource
import com.ritense.authorization.AuthorizationService
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@AutoConfiguration
@EnableJpaRepositories(basePackageClasses = [AdminSettingsLogoRepository::class, FeatureToggleOverridesRepository::class, AccentColorsRepository::class, MenuConfigurationRepository::class])
@EntityScan(basePackages = ["com.ritense.adminsettings.domain"])
class AdminSettingsAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(AdminSettingsLogoService::class)
    fun adminSettingsLogoService(
        adminSettingsLogoRepository: AdminSettingsLogoRepository,
        authorizationService: AuthorizationService,
    ): AdminSettingsLogoService {
        return AdminSettingsLogoService(
            adminSettingsLogoRepository,
            authorizationService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(AdminSettingsLogoResource::class)
    fun adminSettingsLogoResource(
        adminSettingsLogoService: AdminSettingsLogoService
    ): AdminSettingsLogoResource {
        return AdminSettingsLogoResource(adminSettingsLogoService)
    }

    @Bean
    @ConditionalOnMissingBean(FeatureToggleOverridesService::class)
    fun featureToggleOverridesService(
        featureToggleOverridesRepository: FeatureToggleOverridesRepository,
        objectMapper: ObjectMapper,
    ): FeatureToggleOverridesService {
        return FeatureToggleOverridesService(
            featureToggleOverridesRepository,
            objectMapper,
        )
    }

    @Bean
    @ConditionalOnMissingBean(FeatureToggleOverridesResource::class)
    fun featureToggleOverridesResource(
        featureToggleOverridesService: FeatureToggleOverridesService
    ): FeatureToggleOverridesResource {
        return FeatureToggleOverridesResource(featureToggleOverridesService)
    }

    @Order(270)
    @Bean
    @ConditionalOnMissingBean(AdminSettingsHttpSecurityConfigurer::class)
    fun adminSettingsHttpSecurityConfigurer(): AdminSettingsHttpSecurityConfigurer {
        return AdminSettingsHttpSecurityConfigurer()
    }

    @Bean
    @ConditionalOnMissingBean(AccentColorsService::class)
    fun accentColorsService(
        accentColorsRepository: AccentColorsRepository,
        objectMapper: ObjectMapper,
    ): AccentColorsService {
        return AccentColorsService(
            accentColorsRepository,
            objectMapper,
        )
    }

    @Bean
    @ConditionalOnMissingBean(AccentColorsResource::class)
    fun accentColorsResource(
        accentColorsService: AccentColorsService
    ): AccentColorsResource {
        return AccentColorsResource(accentColorsService)
    }

    @Bean
    @ConditionalOnMissingBean(MenuConfigurationService::class)
    fun menuConfigurationService(
        menuConfigurationRepository: MenuConfigurationRepository,
        objectMapper: ObjectMapper,
    ): MenuConfigurationService {
        return MenuConfigurationService(
            menuConfigurationRepository,
            objectMapper,
        )
    }

    @Bean
    @ConditionalOnMissingBean(MenuConfigurationResource::class)
    fun menuConfigurationResource(
        menuConfigurationService: MenuConfigurationService
    ): MenuConfigurationResource {
        return MenuConfigurationResource(menuConfigurationService)
    }

    @Bean
    @ConditionalOnMissingBean(AdminSettingsFeatureToggleImporter::class)
    fun adminSettingsFeatureToggleImporter(
        objectMapper: ObjectMapper,
        featureToggleOverridesService: FeatureToggleOverridesService,
    ): AdminSettingsFeatureToggleImporter {
        return AdminSettingsFeatureToggleImporter(
            objectMapper,
            featureToggleOverridesService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(AdminSettingsAccentColorsImporter::class)
    fun adminSettingsAccentColorsImporter(
        objectMapper: ObjectMapper,
        accentColorsService: AccentColorsService,
    ): AdminSettingsAccentColorsImporter {
        return AdminSettingsAccentColorsImporter(
            objectMapper,
            accentColorsService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(AdminSettingsLogoImporter::class)
    fun adminSettingsLogoImporter(
        adminSettingsLogoRepository: AdminSettingsLogoRepository,
    ): AdminSettingsLogoImporter {
        return AdminSettingsLogoImporter(
            adminSettingsLogoRepository,
        )
    }
}
