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

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.web.client.RestTemplate
import java.net.URL

@ConfigurationProperties(prefix = "valtimo.marketplace")
data class MarketplaceProperties(
    val repositories: Map<String, URL> = emptyMap(),
    val multiInstanceCron: String = "0 0 * * * ?",
    // How often the merged catalogue is re-read from the configured repositories.
    // The catalogue is served from cache in between, so this is what determines how
    // quickly a newly published package shows up (an explicit refresh from the UI
    // always works). Default: every 30 minutes.
    val catalogueRefreshCron: String = "0 */30 * * * ?",
    // Valtimo version used to decide whether a release's `requires` constraint is
    // satisfied. Leave unset in a packaged deployment: it is then read from the
    // marketplace jar's Implementation-Version. It has to be set explicitly when
    // running from source (bootRun/tests), where no jar manifest exists — otherwise
    // the version resolves to "0.0.0" and pf4j skips compatibility checking
    // altogether, letting a package that needs a newer Valtimo install and then
    // fail at load.
    val systemVersion: String? = null,
    // Source-repository owners whose packages are presented as "verified". Trust is
    // decided here rather than read from the manifest on purpose: a store could
    // otherwise declare itself trustworthy. Anything with a known source outside this
    // list is "community"; anything without a source repository is "unknown".
    val trustedOrganizations: List<String> = DEFAULT_TRUSTED_ORGANIZATIONS,
    // Security is out of scope for the marketplace mechanism, so by default the
    // whitelists are NOT enforced: a package may autowire any bean and use
    // any interface/annotation. Set valtimo.marketplace.enforceWhitelist=true to
    // re-enable the sandbox checks in WhitelistSpringExtensionFactory and
    // BeanExtensionClassRegistrationListener.
    val enforceWhitelist: Boolean = false,
    val autowireWhitelist: List<String> = DEFAULT_AUTOWIRE_WHITELIST,
    val annotationWhitelist: List<String> = DEFAULT_BEAN_ANNOTATION_WHITELIST,
    val interfaceWhitelist: List<String> = DEFAULT_BEAN_INTERFACE_WHITELIST,
) {

    fun getPackageRepositories() = repositories.map { PackageUpdateRepository(it.key, it.value) }

    companion object {

        // GitHub organisations whose packages are trusted out of the box.
        val DEFAULT_TRUSTED_ORGANIZATIONS = listOf(
            "valtimo-platform",
            "generiekzaakafhandelcomponent",
        )

        // A package can autowire only these Spring Beans:
        val DEFAULT_AUTOWIRE_WHITELIST = listOf(
            // Valtimo
            "com.ritense.catalogiapi.service.ZaaktypeUrlProvider",
            "com.ritense.plugin.service.PluginInstanceCreator",
            "com.ritense.zakenapi.ZaakUrlProvider",

            // All @ProcessBeans:
            "com.ritense.documentgeneration.service.LocalCamundaProcessDocumentGenerator",
            "com.ritense.mail.service.MailService",
            "com.ritense.processdocument.service.CorrelationService",
            "com.ritense.processdocument.service.DocumentDelegateService",
            "com.ritense.processdocument.service.ProcessDocumentsService",
            "com.ritense.processdocument.service.ValueResolverDelegateService",
            "com.ritense.resource.service.ResourceStorageDelegate",
            "com.ritense.valtimo.camunda.task.service.NotificationService",
            "com.ritense.valtimo.JobService",
            "com.ritense.zakenapi.service.UploadProcessDelegate",

            // Other
            "org.springframework.web.client.RestClient\$Builder",
            "org.springframework.web.client.RestTemplate",
            "org.springframework.context.ApplicationEventPublisher",
            "org.springframework.core.io.support.ResourcePatternResolver",
        )

        // A package is allowed to use these annotations:
        val DEFAULT_BEAN_ANNOTATION_WHITELIST = listOf(
            // Valtimo
            "com.ritense.valtimo.contract.annotation.ProcessBean",
            "com.ritense.formflow.expression.FormFlowBean",

            // Spring
            "org.springframework.transaction.annotation.Transactional",
            "org.springframework.stereotype.Component",
            "org.springframework.stereotype.Controller",
            "org.springframework.stereotype.Service",
            "org.springframework.web.bind.annotation.RestController",
            "org.springframework.web.bind.annotation.RequestMapping",

            // Other
            "kotlin.Metadata",
            "org.pf4j.Extension",
        )

        // A package is to use these interfaces:
        val DEFAULT_BEAN_INTERFACE_WHITELIST = listOf(
            // Valtimo
            "com.ritense.exporter.Exporter",
            "com.ritense.importer.Importer",
            "com.ritense.plugin.PluginFactory",
            "com.ritense.valueresolver.ValueResolverFactory",
            "com.ritense.valtimo.contract.config.LiquibaseMasterChangeLogLocation",
            "com.ritense.valtimo.contract.security.config.HttpSecurityConfigurer",

            // Other
            "java.lang.Object",
            "org.pf4j.ExtensionPoint",
        )
    }
}