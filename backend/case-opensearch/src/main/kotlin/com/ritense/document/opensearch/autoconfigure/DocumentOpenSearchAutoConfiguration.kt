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
import com.ritense.document.opensearch.domain.JsonSchemaDocumentOsDocument
import com.ritense.document.opensearch.handler.DocumentOpenSearchEventHandler
import com.ritense.document.opensearch.repository.JsonSchemaDocumentOpenSearchRepository
import com.ritense.document.opensearch.security.DocumentOpenSearchHttpSecurityConfigurer
import com.ritense.document.opensearch.service.DelegatingDocumentSearchService
import com.ritense.document.opensearch.service.DocumentOpenSearchBackfillService
import com.ritense.document.opensearch.service.DocumentOpenSearchQueryService
import com.ritense.document.opensearch.service.DocumentOpenSearchSyncService
import com.ritense.document.opensearch.service.JsonSchemaDocumentOpenSearchService
import com.ritense.document.opensearch.service.SearchEngineToggle
import com.ritense.document.opensearch.web.DocumentOpenSearchBackfillResource
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
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.AutoConfigureBefore
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.data.elasticsearch.core.ElasticsearchOperations
import org.springframework.data.elasticsearch.repository.config.EnableElasticsearchRepositories

@AutoConfiguration
@AutoConfigureBefore(DocumentAutoConfiguration::class)
@ConditionalOnClass(ElasticsearchOperations::class)
@EnableElasticsearchRepositories(basePackages = ["com.ritense.document.opensearch.repository"])
@EnableConfigurationProperties(OpenSearchProperties::class)
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
    fun documentOpenSearchSyncService(
        repository: JsonSchemaDocumentOpenSearchRepository,
        objectMapper: ObjectMapper,
    ): DocumentOpenSearchSyncService =
        DocumentOpenSearchSyncService(repository, objectMapper)

    @Bean
    fun documentOpenSearchEventHandler(syncService: DocumentOpenSearchSyncService): DocumentOpenSearchEventHandler =
        DocumentOpenSearchEventHandler(syncService)

    @Bean
    @ConditionalOnMissingBean
    fun documentOpenSearchBackfillService(
        entityManager: EntityManager,
        openSearchRepository: JsonSchemaDocumentOpenSearchRepository,
        objectMapper: ObjectMapper,
        restHighLevelClient: org.opensearch.client.RestHighLevelClient,
        transactionManager: org.springframework.transaction.PlatformTransactionManager,
    ): DocumentOpenSearchBackfillService =
        DocumentOpenSearchBackfillService(entityManager, openSearchRepository, objectMapper, restHighLevelClient, transactionManager)

    @Order(294)
    @Bean
    @ConditionalOnMissingBean
    fun documentOpenSearchHttpSecurityConfigurer(): DocumentOpenSearchHttpSecurityConfigurer =
        DocumentOpenSearchHttpSecurityConfigurer()

    // --- Search engine toggle: both implementations + delegating service ---

    @Bean
    @ConditionalOnMissingBean
    fun searchEngineToggle(): SearchEngineToggle = SearchEngineToggle()

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
    ): DelegatingDocumentSearchService =
        DelegatingDocumentSearchService(openSearchDocumentSearchService, jpaDocumentSearchService, searchEngineToggle)

    @Bean
    @ConditionalOnMissingBean
    fun searchEngineResource(
        toggle: SearchEngineToggle,
        openSearchProperties: OpenSearchProperties,
        featureToggleOverridesService: FeatureToggleOverridesService,
    ): SearchEngineResource =
        SearchEngineResource(toggle, openSearchProperties, featureToggleOverridesService)

    @Bean
    @ConditionalOnMissingBean
    fun documentOpenSearchBackfillResource(
        backfillService: DocumentOpenSearchBackfillService,
    ): DocumentOpenSearchBackfillResource =
        DocumentOpenSearchBackfillResource(backfillService)

    /**
     * Creates the OpenSearch index and mappings on startup if the index does not yet exist.
     */
    @Bean
    fun documentOpenSearchIndexInitializer(elasticsearchOperations: ElasticsearchOperations): ApplicationRunner =
        ApplicationRunner {
            try {
                val indexOps = elasticsearchOperations.indexOps(JsonSchemaDocumentOsDocument::class.java)
                if (!indexOps.exists()) {
                    val settings = org.springframework.data.elasticsearch.core.document.Document.create()
                    settings["index.number_of_replicas"] = 0
                    indexOps.create(settings)

                    // Merge annotated mapping with a dynamic template that forces all
                    // content.* fields to text+keyword — enables wildcard search on numbers too
                    val annotatedMapping = indexOps.createMapping(JsonSchemaDocumentOsDocument::class.java)
                    val dynamicTemplates = listOf(
                        mapOf("content_fields_as_text" to mapOf(
                            "path_match" to "content.*",
                            "mapping" to mapOf(
                                "type" to "text",
                                "fields" to mapOf("keyword" to mapOf("type" to "keyword", "ignore_above" to 256))
                            )
                        ))
                    )
                    annotatedMapping["dynamic_templates"] = dynamicTemplates
                    indexOps.putMapping(annotatedMapping)
                }
            } catch (e: Exception) {
                logger.warn(e) { "Failed to initialize OpenSearch index — is OpenSearch running?" }
            }
        }

    @Bean
    fun searchEngineSettingLoader(
        toggle: SearchEngineToggle,
        featureToggleOverridesService: FeatureToggleOverridesService,
        openSearchProperties: OpenSearchProperties,
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
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        const val SEARCH_ENGINE_TOGGLE_KEY = "useOpenSearchForDocumentSearch"
    }
}
