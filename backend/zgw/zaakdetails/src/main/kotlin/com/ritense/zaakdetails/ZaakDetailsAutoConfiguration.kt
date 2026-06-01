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

package com.ritense.zaakdetails

import com.ritense.document.service.DocumentService
import com.ritense.objectenapi.management.ObjectManagementInfoProvider
import com.ritense.objectmanagement.repository.ObjectManagementRepository
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.zaakdetails.endpoint.ZaakDetailsEndpointDescriptionProvider
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSyncCaseEventListener
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSyncExporter
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSyncImporter
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSyncManagementResource
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSyncManagementService
import com.ritense.zaakdetails.documentobjectenapisync.listener.DocumentObjectenApiSyncConfigurationIssueListener
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSyncRepository
import com.ritense.zaakdetails.documentobjectenapisync.DocumentObjectenApiSyncService
import com.ritense.zaakdetails.repository.ZaakdetailsObjectRepository
import com.ritense.zaakdetails.security.ZaakDetailsHttpSecurityConfigurer
import com.ritense.zaakdetails.service.ZaakdetailsObjectService
import com.ritense.zakenapi.ZaakUrlProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.ApplicationEventPublisher
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@EnableJpaRepositories(basePackageClasses = [DocumentObjectenApiSyncRepository::class, ZaakdetailsObjectRepository::class])
@EntityScan(basePackages = ["com.ritense.zaakdetails.documentobjectenapisync", "com.ritense.zaakdetails.domain"])
@AutoConfiguration
class ZaakDetailsAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(DocumentObjectenApiSyncManagementService::class)
    fun documentObjectenApiSyncManagementService(
        documentObjectenApiSyncRepository: DocumentObjectenApiSyncRepository,
        caseDefinitionChecker: CaseDefinitionChecker,
        applicationEventPublisher: ApplicationEventPublisher,
    ): DocumentObjectenApiSyncManagementService {
        return DocumentObjectenApiSyncManagementService(
            documentObjectenApiSyncRepository = documentObjectenApiSyncRepository,
            caseDefinitionChecker = caseDefinitionChecker,
            applicationEventPublisher = applicationEventPublisher,
        )
    }

    @Bean
    @ConditionalOnMissingBean(DocumentObjectenApiSyncService::class)
    fun documentObjectenApiSyncService(
        objectObjectManagementInfoProvider: ObjectManagementInfoProvider,
        documentService: DocumentService,
        pluginService: PluginService,
        zaakUrlProvider: ZaakUrlProvider,
        zaakdetailsObjectService: ZaakdetailsObjectService,
        documentObjectenApiSyncManagementService: DocumentObjectenApiSyncManagementService,
        @Value("\${valtimo.zgw.zaakdetails.linktozaak.enabled:false}") linkZaakdetailsToZaakEnabled: Boolean
    ): DocumentObjectenApiSyncService {
        return DocumentObjectenApiSyncService(
            objectObjectManagementInfoProvider,
            documentService,
            pluginService,
            zaakUrlProvider,
            zaakdetailsObjectService,
            documentObjectenApiSyncManagementService,
            linkZaakdetailsToZaakEnabled
        )
    }

    @Bean
    @ConditionalOnMissingBean(DocumentObjectenApiSyncManagementResource::class)
    fun documentObjectenApiSyncManagementResource(
        documentObjectenApiSyncManagementService: DocumentObjectenApiSyncManagementService,
        objectManagementInfoProvider: ObjectManagementInfoProvider,
    ): DocumentObjectenApiSyncManagementResource {
        return DocumentObjectenApiSyncManagementResource(
            documentObjectenApiSyncManagementService,
            objectManagementInfoProvider,
        )
    }

    @Order(400)
    @Bean
    @ConditionalOnMissingBean(ZaakDetailsHttpSecurityConfigurer::class)
    fun zaakDetailsHttpSecurityConfigurer(): ZaakDetailsHttpSecurityConfigurer {
        return ZaakDetailsHttpSecurityConfigurer()
    }

    @Bean
    @ConditionalOnMissingBean(ZaakdetailsObjectService::class)
    fun zaakdetailsObjectService(
        zaakdetailsObjectRepository: ZaakdetailsObjectRepository
    ): ZaakdetailsObjectService {
        return ZaakdetailsObjectService(zaakdetailsObjectRepository)
    }

    @Bean
    @ConditionalOnMissingBean(DocumentObjectenApiSyncCaseEventListener::class)
    fun documentObjectenApiSyncCaseEventListener(
        documentObjectenApiSyncManagementService: DocumentObjectenApiSyncManagementService,
    ): DocumentObjectenApiSyncCaseEventListener {
        return DocumentObjectenApiSyncCaseEventListener(
            documentObjectenApiSyncManagementService,
        )
    }

    @Bean
    @ConditionalOnMissingBean(DocumentObjectenApiSyncImporter::class)
    fun documentObjectenApiSyncImporter(
        objectMapper: ObjectMapper,
        documentObjectenApiSyncRepository: DocumentObjectenApiSyncRepository,
        applicationEventPublisher: ApplicationEventPublisher,
        objectManagementRepository: ObjectManagementRepository
    ): DocumentObjectenApiSyncImporter {
        return DocumentObjectenApiSyncImporter(
            objectMapper,
            documentObjectenApiSyncRepository,
            applicationEventPublisher,
            objectManagementRepository
        )
    }

    @Bean
    @ConditionalOnMissingBean(DocumentObjectenApiSyncExporter::class)
    fun documentObjectenApiSyncExporter(
        objectMapper: ObjectMapper,
        documentObjectenApiSyncRepository: DocumentObjectenApiSyncRepository
    ): DocumentObjectenApiSyncExporter {
        return DocumentObjectenApiSyncExporter(
            objectMapper,
            documentObjectenApiSyncRepository
        )
    }

    @Bean
    @ConditionalOnMissingBean(DocumentObjectenApiSyncConfigurationIssueListener::class)
    fun documentObjectenApiSyncConfigurationIssueListener(
        applicationEventPublisher: ApplicationEventPublisher
    ) = DocumentObjectenApiSyncConfigurationIssueListener(applicationEventPublisher)

    @Bean
    @ConditionalOnMissingBean(ZaakDetailsEndpointDescriptionProvider::class)
    fun zaakDetailsEndpointDescriptionProvider() = ZaakDetailsEndpointDescriptionProvider()
}
