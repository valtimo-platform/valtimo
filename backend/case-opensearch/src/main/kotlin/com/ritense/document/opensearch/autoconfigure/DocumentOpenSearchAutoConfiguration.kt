/*
 *
 *  * Copyright 2015-2026 Ritense BV, the Netherlands.
 *  *
 *  * Licensed under EUPL, Version 1.2 (the "License");
 *  * you may not use this file except in compliance with the License.
 *  * You may obtain a copy of the License at
 *  *
 *  * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *  *
 *  * Unless required by applicable law or agreed to in writing, software
 *  * distributed under the License is distributed on an "AS IS" basis,
 *  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  * See the License for the specific language governing permissions and
 *  * limitations under the License.
 *
 */

package com.ritense.document.opensearch.autoconfigure

import com.fasterxml.jackson.databind.ObjectMapper
import io.github.oshai.kotlinlogging.KotlinLogging
import com.ritense.adminsettings.service.FeatureToggleOverridesService
import com.ritense.authorization.AuthorizationService
import com.ritense.document.opensearch.OpenSearchProperties
import com.ritense.document.autoconfigure.DocumentAutoConfiguration
import com.ritense.document.opensearch.authorization.OpenSearchAuthorizationEntityMapper
import com.ritense.document.opensearch.authorization.OpenSearchPermissionConditionTranslator
import com.ritense.document.opensearch.authorization.mapper.JsonSchemaDocumentCaseDefinitionOpenSearchMapper
import com.ritense.document.opensearch.authorization.mapper.JsonSchemaDocumentDefinitionOpenSearchMapper
import com.ritense.document.opensearch.domain.OpenSearchReindexRun
import com.ritense.document.opensearch.handler.DocumentOpenSearchEventListener
import com.ritense.document.opensearch.handler.PendingIndexDeletionListener
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import com.ritense.document.opensearch.repository.OpenSearchReconcileStateRepository
import com.ritense.document.opensearch.repository.OpenSearchReindexRunRepository
import com.ritense.document.opensearch.repository.PendingIndexDeletionRepository
import com.ritense.document.opensearch.security.DocumentOpenSearchHttpSecurityConfigurer
import com.ritense.document.opensearch.service.DelegatingDocumentSearchService
import com.ritense.document.opensearch.service.DocumentOpenSearchQueryService
import com.ritense.document.opensearch.service.DocumentOpenSearchReconcileJob
import com.ritense.document.opensearch.service.DocumentOpenSearchIndexInitializer
import com.ritense.document.opensearch.service.DocumentOpenSearchReconcileService
import com.ritense.document.opensearch.service.DocumentOpenSearchReindexService
import com.ritense.document.opensearch.service.DocumentOpenSearchSyncService
import com.ritense.document.opensearch.service.JsonSchemaDocumentOpenSearchService
import com.ritense.document.opensearch.service.JsonSchemaDocumentOsConverter
import com.ritense.document.opensearch.service.OpenSearchReindexRunService
import com.ritense.document.opensearch.service.ReindexProgressGate
import com.ritense.document.opensearch.service.OpenSearchHealthService
import com.ritense.document.opensearch.service.SearchEngineToggle
import com.ritense.document.opensearch.web.DocumentOpenSearchReindexResource
import com.ritense.document.opensearch.web.SearchEngineResource
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.document.service.SearchFieldService
import com.ritense.document.service.impl.JsonSchemaDocumentSearchService
import com.ritense.valtimo.contract.database.QueryDialectHelper
import com.ritense.outbox.OutboxService
import com.ritense.valtimo.contract.authentication.TeamManagementService
import com.ritense.valtimo.contract.authentication.UserManagementService
import jakarta.persistence.EntityManager
import net.javacrumbs.shedlock.core.LockProvider
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.AutoConfigureBefore
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.repository.config.EnableElasticsearchRepositories
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.scheduling.annotation.Scheduled

@AutoConfiguration
@AutoConfigureBefore(DocumentAutoConfiguration::class)
@ConditionalOnClass(ElasticsearchOperations::class)
@EnableScheduling
@EnableElasticsearchRepositories(basePackages = ["com.ritense.document.opensearch.repository"])
@EnableConfigurationProperties(OpenSearchProperties::class)
@EnableJpaRepositories(basePackageClasses = [OpenSearchReindexRunRepository::class])
@EntityScan(basePackageClasses = [OpenSearchReindexRun::class])
class DocumentOpenSearchAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    fun jsonSchemaDocumentDefinitionOpenSearchMapper(): JsonSchemaDocumentDefinitionOpenSearchMapper =
        JsonSchemaDocumentDefinitionOpenSearchMapper()

    @Bean
    @ConditionalOnMissingBean
    fun jsonSchemaDocumentCaseDefinitionOpenSearchMapper(): JsonSchemaDocumentCaseDefinitionOpenSearchMapper =
        JsonSchemaDocumentCaseDefinitionOpenSearchMapper()

    @Bean
    @ConditionalOnMissingBean
    fun openSearchPermissionConditionTranslator(
        openSearchMappers: List<OpenSearchAuthorizationEntityMapper<*, *>>,
        authorizationService: AuthorizationService,
        documentRepository: JsonSchemaDocumentRepository,
    ): OpenSearchPermissionConditionTranslator =
        OpenSearchPermissionConditionTranslator(openSearchMappers, authorizationService, documentRepository)

    @Bean
    @ConditionalOnMissingBean
    fun documentOpenSearchQueryService(
        elasticsearchOperations: ElasticsearchOperations,
        authorizationService: AuthorizationService,
        translator: OpenSearchPermissionConditionTranslator,
    ): DocumentOpenSearchQueryService =
        DocumentOpenSearchQueryService(elasticsearchOperations, authorizationService, translator)

    @Bean
    @ConditionalOnMissingBean
    fun jsonSchemaDocumentOsConverter(
        objectMapper: ObjectMapper,
        openSearchRepository: JsonSchemaDocumentOpenSearchRepository,
    ): JsonSchemaDocumentOsConverter =
        JsonSchemaDocumentOsConverter(objectMapper, openSearchRepository)

    @Bean
    @ConditionalOnMissingBean
    fun documentOpenSearchSyncService(
        repository: JsonSchemaDocumentOpenSearchRepository,
        documentRepository: JsonSchemaDocumentRepository,
        converter: JsonSchemaDocumentOsConverter,
        transactionManager: PlatformTransactionManager,
    ): DocumentOpenSearchSyncService =
        DocumentOpenSearchSyncService(repository, documentRepository, converter, transactionManager)

    @Bean
    @ConditionalOnProperty(prefix = "valtimo.opensearch", name = ["enabled"], havingValue = "true", matchIfMissing = true)
    fun documentOpenSearchEventListener(
        syncService: DocumentOpenSearchSyncService,
        searchEngineToggle: SearchEngineToggle,
    ): DocumentOpenSearchEventListener =
        DocumentOpenSearchEventListener(syncService, searchEngineToggle)

    @Bean
    @ConditionalOnMissingBean
    fun openSearchReindexRunService(
        openSearchReindexRunRepository: OpenSearchReindexRunRepository,
        objectMapper: ObjectMapper,
        openSearchProperties: OpenSearchProperties,
        entityManager: EntityManager,
    ): OpenSearchReindexRunService =
        OpenSearchReindexRunService(openSearchReindexRunRepository, objectMapper, openSearchProperties, entityManager)

    @Bean
    @ConditionalOnMissingBean
    fun documentOpenSearchReindexService(
        entityManager: EntityManager,
        converter: JsonSchemaDocumentOsConverter,
        elasticsearchOperations: ElasticsearchOperations,
        transactionManager: PlatformTransactionManager,
        lockProvider: LockProvider,
        openSearchReindexRunService: OpenSearchReindexRunService,
    ): DocumentOpenSearchReindexService =
        DocumentOpenSearchReindexService(
            entityManager,
            converter,
            elasticsearchOperations,
            transactionManager,
            lockProvider,
            openSearchReindexRunService,
        )

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "valtimo.opensearch", name = ["enabled"], havingValue = "true", matchIfMissing = true)
    fun documentOpenSearchReconcileService(
        entityManager: EntityManager,
        converter: JsonSchemaDocumentOsConverter,
        openSearchRepository: JsonSchemaDocumentOpenSearchRepository,
        reconcileStateRepository: OpenSearchReconcileStateRepository,
        pendingIndexDeletionRepository: PendingIndexDeletionRepository,
        transactionManager: PlatformTransactionManager,
        lockProvider: LockProvider,
        openSearchProperties: OpenSearchProperties,
    ): DocumentOpenSearchReconcileService =
        DocumentOpenSearchReconcileService(
            entityManager,
            converter,
            openSearchRepository,
            reconcileStateRepository,
            pendingIndexDeletionRepository,
            transactionManager,
            lockProvider,
            openSearchProperties,
        )

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnBean(DocumentOpenSearchReconcileService::class)
    @ConditionalOnProperty(prefix = "valtimo.opensearch.reconcile", name = ["enabled"], havingValue = "true", matchIfMissing = true)
    fun documentOpenSearchReconcileJob(
        reconcileService: DocumentOpenSearchReconcileService,
        searchEngineToggle: SearchEngineToggle,
    ): DocumentOpenSearchReconcileJob =
        DocumentOpenSearchReconcileJob(reconcileService, searchEngineToggle)

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "valtimo.opensearch", name = ["enabled"], havingValue = "true", matchIfMissing = true)
    fun pendingIndexDeletionListener(
        pendingIndexDeletionRepository: PendingIndexDeletionRepository,
    ): PendingIndexDeletionListener =
        PendingIndexDeletionListener(pendingIndexDeletionRepository)

    @Order(294)
    @Bean
    @ConditionalOnMissingBean
    fun documentOpenSearchHttpSecurityConfigurer(): DocumentOpenSearchHttpSecurityConfigurer =
        DocumentOpenSearchHttpSecurityConfigurer()

    // --- Search engine toggle: both implementations + delegating service ---

    @Bean
    @ConditionalOnMissingBean
    // Start in POSTGRES so no OpenSearch call happens before searchEngineSettingLoader resolves the real
    // engine. The @Scheduled reconciler is armed during context refresh, before ApplicationRunners run, so
    // an OPENSEARCH default could otherwise leak one spurious call at startup even when the engine is off.
    fun searchEngineToggle(): SearchEngineToggle = SearchEngineToggle(SearchEngineToggle.Engine.POSTGRES)

    @Bean
    @ConditionalOnMissingBean
    fun reindexProgressGate(
        openSearchReindexRunService: OpenSearchReindexRunService,
        openSearchProperties: OpenSearchProperties,
    ): ReindexProgressGate =
        ReindexProgressGate(openSearchReindexRunService, openSearchProperties)

    @Bean("openSearchDocumentSearchService")
    fun openSearchDocumentSearchService(
        elasticsearchOperations: ElasticsearchOperations,
        translator: OpenSearchPermissionConditionTranslator,
        authorizationService: AuthorizationService,
        jpaRepository: JsonSchemaDocumentRepository,
        userManagementService: UserManagementService,
        searchFieldService: SearchFieldService,
        outboxService: OutboxService,
        objectMapper: ObjectMapper,
    ): JsonSchemaDocumentOpenSearchService =
        JsonSchemaDocumentOpenSearchService(
            elasticsearchOperations, translator, authorizationService,
            jpaRepository, userManagementService, searchFieldService, outboxService, objectMapper,
        )

    @Bean("jpaDocumentSearchService")
    fun jpaDocumentSearchService(
        entityManager: EntityManager,
        queryDialectHelper: QueryDialectHelper,
        searchFieldService: SearchFieldService,
        userManagementService: UserManagementService,
        teamManagementService: TeamManagementService,
        authorizationService: AuthorizationService,
        outboxService: OutboxService,
        jsonSchemaDocumentDefinitionService: JsonSchemaDocumentDefinitionService,
        objectMapper: ObjectMapper,
    ): JsonSchemaDocumentSearchService =
        JsonSchemaDocumentSearchService(
            entityManager, queryDialectHelper, searchFieldService,
            userManagementService, teamManagementService, authorizationService, outboxService,
            jsonSchemaDocumentDefinitionService, objectMapper,
        )

    @Bean
    @org.springframework.context.annotation.Primary
    fun documentSearchService(
        openSearchDocumentSearchService: JsonSchemaDocumentOpenSearchService,
        jpaDocumentSearchService: JsonSchemaDocumentSearchService,
        searchEngineToggle: SearchEngineToggle,
        reindexProgressGate: ReindexProgressGate,
    ): DelegatingDocumentSearchService =
        DelegatingDocumentSearchService(
            openSearchDocumentSearchService, jpaDocumentSearchService, searchEngineToggle, reindexProgressGate,
        )

    @Bean
    @ConditionalOnMissingBean
    fun searchEngineResource(
        toggle: SearchEngineToggle,
        openSearchProperties: OpenSearchProperties,
        featureToggleOverridesService: FeatureToggleOverridesService,
        indexInitializer: DocumentOpenSearchIndexInitializer,
    ): SearchEngineResource =
        SearchEngineResource(toggle, openSearchProperties, featureToggleOverridesService, indexInitializer)

    @Bean
    @ConditionalOnMissingBean
    fun documentOpenSearchReindexResource(
        reindexService: DocumentOpenSearchReindexService,
    ): DocumentOpenSearchReindexResource =
        DocumentOpenSearchReindexResource(reindexService)

    @Bean
    @ConditionalOnMissingBean
    fun documentOpenSearchIndexInitializer(
        elasticsearchOperations: ElasticsearchOperations,
    ): DocumentOpenSearchIndexInitializer =
        DocumentOpenSearchIndexInitializer(elasticsearchOperations)

    /**
     * Resolves the active search engine on startup from configuration and the persisted feature-toggle
     * override, then — only when OpenSearch is the active engine — provisions the index. Merged into a
     * single ordered runner so the toggle is always set before any index/OpenSearch work is decided, and
     * so a disabled or toggled-off engine performs no active OpenSearch call at all on boot.
     */
    @Bean
    fun searchEngineSettingLoader(
        toggle: SearchEngineToggle,
        featureToggleOverridesService: FeatureToggleOverridesService,
        openSearchProperties: OpenSearchProperties,
        indexInitializer: DocumentOpenSearchIndexInitializer,
    ): ApplicationRunner = ApplicationRunner {
        if (!openSearchProperties.enabled) {
            toggle.set(SearchEngineToggle.Engine.POSTGRES)
            logger.info { "OpenSearch disabled via configuration; using PostgreSQL for document search" }
            return@ApplicationRunner
        }

        val overrides = featureToggleOverridesService.getOverrides().overrides
        val useOpenSearch = overrides[SEARCH_ENGINE_TOGGLE_KEY] ?: true
        val engine = if (useOpenSearch) SearchEngineToggle.Engine.OPENSEARCH else SearchEngineToggle.Engine.POSTGRES
        toggle.set(engine)
        logger.info { "Document search engine set to: ${engine.name}" }

        if (toggle.isOpenSearchActive()) {
            indexInitializer.ensureIndex()
        }
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(
        prefix = "valtimo.opensearch",
        name = ["health-check-enabled"],
        havingValue = "true",
        matchIfMissing = true
    )
    fun openSearchHealthService(
        restHighLevelClient: org.opensearch.client.RestHighLevelClient,
        toggle: SearchEngineToggle,
        openSearchProperties: OpenSearchProperties,
    ): OpenSearchHealthService =
        OpenSearchHealthService(restHighLevelClient, toggle, openSearchProperties)

    @Bean
    @ConditionalOnProperty(
        prefix = "valtimo.opensearch",
        name = ["health-check-enabled"],
        havingValue = "true",
        matchIfMissing = true
    )
    fun openSearchHealthScheduler(
        healthService: OpenSearchHealthService,
        openSearchProperties: OpenSearchProperties,
    ): OpenSearchHealthScheduler =
        OpenSearchHealthScheduler(healthService, openSearchProperties)

    companion object {
        private val logger = KotlinLogging.logger {}
        const val SEARCH_ENGINE_TOGGLE_KEY = "useOpenSearchForDocumentSearch"
    }
}

class OpenSearchHealthScheduler(
    private val healthService: OpenSearchHealthService,
    private val properties: OpenSearchProperties,
) {
    @Scheduled(fixedDelayString = "\${valtimo.opensearch.health-check-interval-ms:30000}")
    fun checkHealth() {
        healthService.checkAndRecover()
    }
}
