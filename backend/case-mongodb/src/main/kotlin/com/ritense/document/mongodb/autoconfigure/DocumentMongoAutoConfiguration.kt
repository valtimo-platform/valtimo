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

package com.ritense.document.mongodb.autoconfigure

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationService
import com.ritense.document.autoconfigure.DocumentAutoConfiguration
import com.ritense.document.mongodb.authorization.MongoAuthorizationEntityMapper
import com.ritense.document.mongodb.authorization.MongoPermissionConditionTranslator
import com.ritense.document.mongodb.authorization.mapper.JsonSchemaDocumentCaseDefinitionMongoMapper
import com.ritense.document.mongodb.authorization.mapper.JsonSchemaDocumentDefinitionMongoMapper
import com.ritense.document.mongodb.converter.DocumentToJsonNodeReadConverter
import com.ritense.document.mongodb.converter.DocumentToObjectNodeReadConverter
import com.ritense.document.mongodb.converter.JsonNodeWriteConverter
import com.ritense.document.mongodb.domain.JsonSchemaDocumentDocument
import com.ritense.document.mongodb.handler.DocumentMongoEventHandler
import com.ritense.document.mongodb.repository.JsonSchemaDocumentMongoRepository
import com.ritense.document.mongodb.service.DocumentMongoBackfillService
import com.ritense.document.mongodb.service.DocumentMongoQueryService
import com.ritense.document.mongodb.service.DocumentMongoSyncService
import com.ritense.document.mongodb.service.JsonSchemaDocumentMongoSearchService
import com.ritense.document.mongodb.security.DocumentMongoHttpSecurityConfigurer
import com.ritense.document.mongodb.web.DocumentMongoBackfillResource
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.document.service.DocumentSearchService
import com.ritense.document.service.SearchFieldService
import com.ritense.outbox.OutboxService
import com.ritense.valtimo.contract.authentication.UserManagementService
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.AutoConfigureBefore
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.data.domain.Sort
import org.springframework.data.mongodb.core.MongoTemplate
import org.springframework.data.mongodb.core.convert.MongoCustomConversions
import org.springframework.data.mongodb.core.index.Index
import org.springframework.data.mongodb.core.index.TextIndexDefinition
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories

@AutoConfiguration
@AutoConfigureBefore(DocumentAutoConfiguration::class, MongoDataAutoConfiguration::class)
@ConditionalOnClass(MongoTemplate::class)
@EnableMongoRepositories(basePackages = ["com.ritense.document.mongodb.repository"])
class DocumentMongoAutoConfiguration {

    /**
     * Registers custom converters so that Jackson [com.fasterxml.jackson.databind.JsonNode]/
     * [com.fasterxml.jackson.databind.node.ObjectNode] fields in MongoDB documents are serialized
     * as proper JSON rather than as Jackson's internal object structure.
     *
     * Must run before [MongoDataAutoConfiguration] so this bean wins the
     * [ConditionalOnMissingBean] check there.
     */
    @Bean
    @ConditionalOnMissingBean(MongoCustomConversions::class)
    fun mongoCustomConversions(objectMapper: ObjectMapper): MongoCustomConversions =
        MongoCustomConversions(
            listOf(
                JsonNodeWriteConverter(),
                DocumentToJsonNodeReadConverter(objectMapper),
                DocumentToObjectNodeReadConverter(objectMapper),
            )
        )

    @Bean
    @ConditionalOnMissingBean
    fun jsonSchemaDocumentDefinitionMongoMapper(): JsonSchemaDocumentDefinitionMongoMapper =
        JsonSchemaDocumentDefinitionMongoMapper()

    @Bean
    @ConditionalOnMissingBean
    fun jsonSchemaDocumentCaseDefinitionMongoMapper(): JsonSchemaDocumentCaseDefinitionMongoMapper =
        JsonSchemaDocumentCaseDefinitionMongoMapper()

    @Bean
    @ConditionalOnMissingBean
    fun mongoPermissionConditionTranslator(
        mongoMappers: List<MongoAuthorizationEntityMapper<*, *>>,
        authorizationService: AuthorizationService,
        documentRepository: JsonSchemaDocumentRepository,
    ): MongoPermissionConditionTranslator =
        MongoPermissionConditionTranslator(mongoMappers, authorizationService, documentRepository)

    @Bean
    @ConditionalOnMissingBean
    fun documentMongoQueryService(
        mongoTemplate: MongoTemplate,
        authorizationService: AuthorizationService,
        translator: MongoPermissionConditionTranslator,
    ): DocumentMongoQueryService =
        DocumentMongoQueryService(mongoTemplate, authorizationService, translator)

    @Bean
    @ConditionalOnMissingBean
    fun documentMongoSyncService(
        repository: JsonSchemaDocumentMongoRepository,
        objectMapper: ObjectMapper,
    ): DocumentMongoSyncService =
        DocumentMongoSyncService(repository, objectMapper)

    @Bean
    fun documentMongoEventHandler(syncService: DocumentMongoSyncService): DocumentMongoEventHandler =
        DocumentMongoEventHandler(syncService)

    @Bean
    @ConditionalOnMissingBean
    fun documentMongoBackfillService(
        jpaRepository: JsonSchemaDocumentRepository,
        mongoRepository: JsonSchemaDocumentMongoRepository,
        objectMapper: ObjectMapper,
    ): DocumentMongoBackfillService =
        DocumentMongoBackfillService(jpaRepository, mongoRepository, objectMapper)

    @Order(293)
    @Bean
    @ConditionalOnMissingBean
    fun documentMongoHttpSecurityConfigurer(): DocumentMongoHttpSecurityConfigurer =
        DocumentMongoHttpSecurityConfigurer()

    @Bean
    @ConditionalOnMissingBean(DocumentSearchService::class)
    fun documentSearchService(
        mongoTemplate: MongoTemplate,
        translator: MongoPermissionConditionTranslator,
        authorizationService: AuthorizationService,
        jpaRepository: JsonSchemaDocumentRepository,
        userManagementService: UserManagementService,
        searchFieldService: SearchFieldService,
        outboxService: OutboxService,
        objectMapper: ObjectMapper,
    ): JsonSchemaDocumentMongoSearchService =
        JsonSchemaDocumentMongoSearchService(
            mongoTemplate,
            translator,
            authorizationService,
            jpaRepository,
            userManagementService,
            searchFieldService,
            outboxService,
            objectMapper,
        )

    @Bean
    @ConditionalOnMissingBean
    fun documentMongoBackfillResource(
        backfillService: DocumentMongoBackfillService,
    ): DocumentMongoBackfillResource =
        DocumentMongoBackfillResource(backfillService)

    /**
     * Creates the indexes for the [JsonSchemaDocumentDocument] collection on startup.
     *
     * This is done programmatically rather than relying solely on [@CompoundIndex] annotations,
     * because [spring.data.mongodb.auto-index-creation] is typically disabled in production.
     * [MongoTemplate.indexOps] + [ensureIndex] is idempotent: it creates missing indexes and
     * is a no-op when the index already exists with the same definition.
     */
    @Bean
    fun documentMongoIndexInitializer(mongoTemplate: MongoTemplate): ApplicationRunner = ApplicationRunner {
        val ops = mongoTemplate.indexOps(JsonSchemaDocumentDocument::class.java)

        ops.ensureIndex(
            Index()
                .on("definitionId.blueprintId.blueprintType", Sort.Direction.ASC)
                .on("definitionId.name", Sort.Direction.ASC)
                .on("createdOn", Sort.Direction.DESC)
                .named("idx_type_name_created"),
        )
        ops.ensureIndex(
            Index()
                .on("definitionId.blueprintId.blueprintType", Sort.Direction.ASC)
                .on("definitionId.name", Sort.Direction.ASC)
                .on("internalStatus", Sort.Direction.ASC)
                .on("createdOn", Sort.Direction.DESC)
                .named("idx_type_name_status_created"),
        )
        ops.ensureIndex(
            Index()
                .on("definitionId.blueprintId.blueprintType", Sort.Direction.ASC)
                .on("definitionId.name", Sort.Direction.ASC)
                .on("assigneeId", Sort.Direction.ASC)
                .on("createdOn", Sort.Direction.DESC)
                .named("idx_type_name_assignee_created"),
        )
        ops.ensureIndex(
            Index()
                .on("definitionId.blueprintId.blueprintType", Sort.Direction.ASC)
                .on("definitionId.name", Sort.Direction.ASC)
                .on("sequence", Sort.Direction.ASC)
                .named("idx_type_name_sequence"),
        )
        ops.ensureIndex(
            TextIndexDefinition.builder()
                .onField("contentText")
                .named("idx_content_text")
                .build(),
        )
    }
}
