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

package com.ritense.marketplace

import com.ritense.importer.ImportService
import com.ritense.marketplace.repository.PackageJobRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.config.LiquibaseMasterChangeLogLocation
import com.ritense.marketplace.listener.BeanExtensionClassRegistrationListener
import com.ritense.marketplace.web.rest.PackageManagementResource
import com.ritense.marketplace.web.rest.PackagePublicResource
import com.ritense.marketplace.web.rest.MarketplaceCatchAllSecurityConfigurer
import com.ritense.marketplace.web.rest.PackageSecurityConfigurer
import jakarta.persistence.EntityManager
import org.pf4j.update.UpdateManager
import org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Lazy
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.core.env.Environment
import org.springframework.core.io.support.ResourcePatternResolver
import java.net.URI
import kotlin.io.path.Path
import kotlin.io.path.createDirectories

@EnableConfigurationProperties(MarketplaceProperties::class)
@AutoConfiguration
// The marketplace's own entity/repository (the package job audit trail) is not picked up
// by the host's scanning, since this module is deliberately outside component scan.
@EntityScan("com.ritense.marketplace.domain")
@EnableJpaRepositories(basePackageClasses = [PackageJobRepository::class])
class MarketplaceAutoConfiguration {

    @Order(Ordered.HIGHEST_PRECEDENCE + 5)
    @Bean
    @ConditionalOnMissingBean(name = ["marketplaceLiquibaseMasterChangeLogLocation"])
    fun marketplaceLiquibaseMasterChangeLogLocation(): LiquibaseMasterChangeLogLocation {
        return LiquibaseMasterChangeLogLocation("config/liquibase/marketplace-master.xml")
    }

    @Bean
    @ConditionalOnMissingBean(PackageManager::class)
    fun valtimoPackageManager(
        resourceResolver: ResourcePatternResolver,
        marketplaceProperties: MarketplaceProperties,
        entityManager: EntityManager,
        environment: Environment,
        ): PackageManager {
        val valtimoPackagePath = if (environment.matchesProfiles("dev")) {
            Path("src/main/resources/config/packages")
        } else {
            Path("tmp/packages")
        }
        valtimoPackagePath.createDirectories()
        return PackageManager(
            listOf(valtimoPackagePath),
            resourceResolver,
            marketplaceProperties,
            entityManager,
        )
    }

    @Bean
    @ConditionalOnMissingBean(UpdateManager::class)
    fun valtimoPackageUpdateManager(
        resourceResolver: ResourcePatternResolver,
        valtimoPackageManager: PackageManager,
        marketplaceProperties: MarketplaceProperties,
        @Lazy repositories: List<PackageUpdateRepository>,
        importService: ImportService,
        caseDefinitionChecker: CaseDefinitionChecker,
        buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker,
        packageTrustResolver: PackageTrustResolver,
    ): PackageUpdateManager {
        return PackageUpdateManager(
            valtimoPackageManager,
            repositories + marketplaceProperties.getPackageRepositories(),
            importService,
            caseDefinitionChecker,
            buildingBlockDefinitionChecker,
            packageTrustResolver,
        )
    }

    @Bean
    @ConditionalOnMissingBean(PackageTrustResolver::class)
    fun packageTrustResolver(marketplaceProperties: MarketplaceProperties): PackageTrustResolver {
        return PackageTrustResolver(marketplaceProperties.trustedOrganizations)
    }

    @Bean
    @ConditionalOnMissingBean(PackagePreflightService::class)
    fun packagePreflightService(
        valtimoPackageUpdateManager: PackageUpdateManager,
        packageTrustResolver: PackageTrustResolver,
    ): PackagePreflightService {
        return PackagePreflightService(valtimoPackageUpdateManager, packageTrustResolver)
    }

    @Bean
    @ConditionalOnMissingBean(PackageJobStore::class)
    fun packageJobStore(packageJobRepository: PackageJobRepository): PackageJobStore {
        return PackageJobStore(packageJobRepository)
    }

    @Bean
    @ConditionalOnMissingBean(PackageJobService::class)
    fun packageJobService(
        valtimoPackageUpdateManager: PackageUpdateManager,
        packageJobStore: PackageJobStore,
        packageJobRepository: PackageJobRepository,
    ): PackageJobService {
        return PackageJobService(valtimoPackageUpdateManager, packageJobStore, packageJobRepository)
    }

    @Bean
    @ConditionalOnMissingBean(PackageUploadService::class)
    fun packageUploadService(
        valtimoPackageManager: PackageManager,
        importService: ImportService,
        packageJobService: PackageJobService,
    ): PackageUploadService {
        return PackageUploadService(valtimoPackageManager, importService, packageJobService)
    }

    /**
     * Clears jobs that a previous process left mid-flight, so a node that died during an
     * install does not leave a row that reads "running" forever.
     */
    @Bean
    @ConditionalOnMissingBean(name = ["marketplaceOrphanedJobCleanup"])
    fun marketplaceOrphanedJobCleanup(packageJobService: PackageJobService): ApplicationRunner {
        return ApplicationRunner { packageJobService.failOrphanedJobs() }
    }

    @Bean
    @ConditionalOnMissingBean(PackageManagementResource::class)
    fun packageManagementResource(
        valtimoPackageManager: PackageManager,
        valtimoPackageUpdateManager: PackageUpdateManager,
        packagePreflightService: PackagePreflightService,
        packageJobService: PackageJobService,
        packageUploadService: PackageUploadService,
    ): PackageManagementResource {
        return PackageManagementResource(
            valtimoPackageManager,
            valtimoPackageUpdateManager,
            packagePreflightService,
            packageJobService,
            packageUploadService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(PackagePublicResource::class)
    fun packagePublicResource(
        valtimoPackageManager: PackageManager,
        valtimoPackageUpdateManager: PackageUpdateManager,
    ): PackagePublicResource {
        return PackagePublicResource(
            valtimoPackageManager,
            valtimoPackageUpdateManager,
        )
    }

    @Bean
    @ConditionalOnMissingBean(ValtimoExtensionsInjector::class)
    fun valtimoExtensionsInjector(
        packageManager: PackageManager,
        @Lazy extensionClassRegistrationListeners: List<ExtensionClassRegistrationListener>,
        pluginDeploymentListener: com.ritense.plugin.PluginDeploymentListener,
    ): ValtimoExtensionsInjector {
        return ValtimoExtensionsInjector(
            packageManager,
            extensionClassRegistrationListeners,
            pluginDeploymentListener,
        )
    }

    @Bean
    @ConditionalOnMissingBean(BeanExtensionClassRegistrationListener::class)
    fun beanExtensionClassRegistrationListener(
        packageManager: PackageManager,
        beanFactory: AbstractAutowireCapableBeanFactory,
        marketplaceProperties: MarketplaceProperties,
    ): BeanExtensionClassRegistrationListener {
        return BeanExtensionClassRegistrationListener(
            packageManager,
            beanFactory,
            marketplaceProperties,
        )
    }

    @Bean
    @ConditionalOnMissingBean(MultiInstancePackageInstaller::class)
    fun multiInstancePackageInstaller(
        packageManager: PackageManager
    ): MultiInstancePackageInstaller {
        return MultiInstancePackageInstaller(packageManager)
    }

    @Bean
    @Order(270)
    @ConditionalOnMissingBean(PackageSecurityConfigurer::class)
    fun packageSecurityConfigurer(): PackageSecurityConfigurer {
        return PackageSecurityConfigurer()
    }

    // Applied LAST so it only covers requests no host configurer matched — i.e.
    // endpoints contributed by runtime-loaded packages, which register after the
    // security chain is built. Only active when the marketplace sandbox is off
    // (the default; security is out of scope for the marketplace mechanism).
    // Applied FIRST (highest precedence): the host chain calls anyRequest() and
    // Spring forbids adding matchers after it, so a permit rule for package
    // endpoints must be registered before the host's rules. It permits everything,
    // which is acceptable because security is explicitly out of scope for the
    // marketplace mechanism (disable with valtimo.marketplace.enforceWhitelist=true).
    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    @ConditionalOnProperty(value = ["valtimo.marketplace.enforceWhitelist"], havingValue = "false", matchIfMissing = true)
    @ConditionalOnMissingBean(MarketplaceCatchAllSecurityConfigurer::class)
    fun marketplaceCatchAllSecurityConfigurer(): MarketplaceCatchAllSecurityConfigurer {
        return MarketplaceCatchAllSecurityConfigurer()
    }

    @Bean
    @ConditionalOnMissingBean(name = ["locallyPublishedPackagesRepository"])
    fun locallyPublishedPackagesRepository(): PackageUpdateRepository {
        // The base URL MUST end in a slash: `packages.json` and every release url are
        // resolved relative to it, and without the slash they resolve against the PARENT
        // directory (the manifest was looked for in ~/packages.json). `Path.toUri()` only
        // appends the slash when the directory already exists, so the directory is created
        // first and the slash is asserted rather than assumed.
        val localPackagesPath = Path(System.getProperty("user.home"), ".valtimo_packages")
        localPackagesPath.createDirectories()
        val localPackagesUri = localPackagesPath.toUri().toString().let {
            if (it.endsWith("/")) it else "$it/"
        }
        return PackageUpdateRepository(
            "locally-published-packages-repository",
            URI(localPackagesUri).toURL()
        )
    }
}