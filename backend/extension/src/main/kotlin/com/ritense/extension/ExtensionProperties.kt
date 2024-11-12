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

import org.springframework.boot.context.properties.ConfigurationProperties
import java.net.URL

@ConfigurationProperties(prefix = "valtimo.extension")
data class ExtensionProperties(
    val repositories: Map<String, URL> = emptyMap(),
    val multiInstanceCron: String = "0 0 * * * ?",
    val autowireWhitelist: List<String> = DEFAULT_AUTOWIRE_WHITELIST,
    val annotationWhitelist: List<String> = DEFAULT_BEAN_ANNOTATION_WHITELIST,
    val interfaceWhitelist: List<String> = DEFAULT_BEAN_INTERFACE_WHITELIST,
) {

    fun getExtensionRepositories() = repositories.map { ExtensionUpdateRepository(it.key, it.value) }

    companion object {

        // These whitelists are meant to prevent breaking changes.

        val DEFAULT_AUTOWIRE_WHITELIST = listOf(
            // Valtimo
            "com.ritense.catalogiapi.service.ZaaktypeUrlProvider",
            "com.ritense.plugin.service.PluginService",
            "com.ritense.zakenapi.ZaakUrlProvider",

            // @ProcessBeans:
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
            "org.springframework.web.client.RestClient.Builder",
            "org.springframework.context.ApplicationEventPublisher",
        )

        val DEFAULT_BEAN_ANNOTATION_WHITELIST = listOf(
            // Valtimo
            "com.ritense.valtimo.contract.annotation.ProcessBean",

            // Spring
            "org.springframework.web.bind.annotation.RestController",
            "org.springframework.web.bind.annotation.RequestMapping",
            "org.springframework.stereotype.Component",
            "org.springframework.stereotype.Controller",
            "org.springframework.stereotype.Service",

            // Other
            "kotlin.Metadata",
            "org.pf4j.Extension",
        )

        val DEFAULT_BEAN_INTERFACE_WHITELIST = listOf(
            // Valtimo
            "com.ritense.exporter.Exporter",
            "com.ritense.importer.Importer",
            "com.ritense.plugin.PluginFactory",
            "com.ritense.valtimo.contract.config.LiquibaseMasterChangeLogLocation",
            "com.ritense.valueresolver.ValueResolverFactory",

            // Other
            "java.lang.Object",
            "org.pf4j.ExtensionPoint",
        )
    }
}