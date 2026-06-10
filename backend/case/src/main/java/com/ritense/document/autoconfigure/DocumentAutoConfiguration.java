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

package com.ritense.document.autoconfigure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ritense.authorization.AuthorizationService;
import com.ritense.document.config.DocumentProperties;
import com.ritense.document.config.DocumentSpringContextHelper;
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition;
import com.ritense.document.domain.impl.listener.DocumentRelatedFileSubmittedEventListenerImpl;
import com.ritense.document.domain.impl.listener.RelatedJsonSchemaDocumentAvailableEventListenerImpl;
import com.ritense.document.domain.impl.sequence.JsonSchemaDocumentDefinitionSequenceRecord;
import com.ritense.document.exporter.JsonSchemaDocumentDefinitionExporter;
import com.ritense.document.importer.CaseJsonSchemaDocumentDefinitionImporter;
import com.ritense.document.listener.DocumentDefinitionCaseEventListener;
import com.ritense.document.listener.JsonSchemaDocumentTeamChangedListener;
import com.ritense.document.repository.DocumentDefinitionRepository;
import com.ritense.document.repository.InternalCaseStatusHistoryRepository;
import com.ritense.document.repository.DocumentDefinitionSequenceRepository;
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository;
import com.ritense.document.service.CaseTagService;
import com.ritense.document.service.DefaultCaseDocumentResolver;
import com.ritense.document.service.DocumentDefinitionService;
import com.ritense.document.service.DocumentSearchService;
import com.ritense.document.service.DocumentSequenceGeneratorService;
import com.ritense.document.service.DocumentService;
import com.ritense.document.service.DocumentStatisticService;
import com.ritense.document.service.InternalCaseStatusService;
import com.ritense.document.service.SearchFieldService;
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionSequenceGeneratorService;
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService;
import com.ritense.document.service.impl.JsonSchemaDocumentSearchService;
import com.ritense.document.service.impl.JsonSchemaDocumentService;
import com.ritense.document.web.rest.DocumentDefinitionManagementResource;
import com.ritense.document.web.rest.DocumentDefinitionResource;
import com.ritense.document.web.rest.DocumentResource;
import com.ritense.document.web.rest.DocumentSearchResource;
import com.ritense.document.web.rest.error.ValidationExceptionMapper;
import com.ritense.document.web.rest.impl.JsonSchemaDocumentDefinitionResource;
import com.ritense.document.web.rest.impl.JsonSchemaDocumentResource;
import com.ritense.document.web.rest.impl.JsonSchemaDocumentSearchResource;
import com.ritense.outbox.OutboxService;
import com.ritense.resource.service.ResourceService;
import com.ritense.valtimo.contract.authentication.UserManagementService;
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker;
import com.ritense.valtimo.contract.database.QueryDialectHelper;
import com.ritense.valtimo.contract.document.BlueprintCaseDocumentResolver;
import com.ritense.valtimo.contract.document.CaseDocumentResolver;
import com.ritense.valtimo.web.sse.service.SseSubscriptionService;
import jakarta.persistence.EntityManager;
import com.ritense.valtimo.contract.authentication.TeamManagementService;
import java.util.List;
import java.util.Optional;
import javax.annotation.Nullable;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.core.io.ResourceLoader;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@AutoConfiguration
@EnableJpaRepositories(basePackages = "com.ritense.document.repository")
@EntityScan("com.ritense.document.domain")
@EnableConfigurationProperties(DocumentProperties.class)
public class DocumentAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(DocumentService.class)
    public JsonSchemaDocumentService documentService(
        final JsonSchemaDocumentRepository documentRepository,
        final JsonSchemaDocumentDefinitionService documentDefinitionService,
        final JsonSchemaDocumentDefinitionSequenceGeneratorService documentSequenceGeneratorService,
        @Nullable final ResourceService resourceService,
        final UserManagementService userManagementService,
        final AuthorizationService authorizationService,
        final ApplicationEventPublisher applicationEventPublisher,
        final SseSubscriptionService sseSubscriptionService,
        final OutboxService outboxService,
        final ObjectMapper objectMapper,
        final InternalCaseStatusService internalCaseStatusService,
        final CaseTagService caseTagService,
        final Optional<TeamManagementService> teamManagementService,
        final EntityManager entityManager,
        final InternalCaseStatusHistoryRepository internalCaseStatusHistoryRepository
    ) {
        return new JsonSchemaDocumentService(
            documentRepository,
            documentDefinitionService,
            documentSequenceGeneratorService,
            resourceService,
            userManagementService,
            authorizationService,
            applicationEventPublisher,
            outboxService,
            objectMapper,
            internalCaseStatusService,
            caseTagService,
            teamManagementService.orElse(null),
            entityManager,
            internalCaseStatusHistoryRepository
        );
    }

    @Bean
    @ConditionalOnMissingBean(CaseDocumentResolver.class)
    public CaseDocumentResolver caseDocumentResolver(
        final DocumentService documentService,
        final List<BlueprintCaseDocumentResolver> blueprintCaseDocumentResolvers
    ) {
        return new DefaultCaseDocumentResolver(documentService, blueprintCaseDocumentResolvers);
    }

    @Bean
    @ConditionalOnMissingBean(DocumentDefinitionService.class)
    public JsonSchemaDocumentDefinitionService documentDefinitionService(
        final ResourceLoader resourceLoader,
        final DocumentDefinitionRepository<JsonSchemaDocumentDefinition> documentDefinitionRepository,
        final AuthorizationService authorizationService,
        final CaseDefinitionChecker caseDefinitionChecker
    ) {
        return new JsonSchemaDocumentDefinitionService(
            resourceLoader,
            documentDefinitionRepository,
            authorizationService,
            caseDefinitionChecker
        );
    }

    @Bean
    @ConditionalOnMissingBean(JsonSchemaDocumentDefinitionExporter.class)
    public JsonSchemaDocumentDefinitionExporter documentDefinitionExporter(
        final JsonSchemaDocumentDefinitionService documentDefinitionService,
        ObjectMapper objectMapper
    ) {
        return new JsonSchemaDocumentDefinitionExporter(
            objectMapper,
            documentDefinitionService
        );
    }

    @Bean
    @ConditionalOnMissingBean
    public CaseJsonSchemaDocumentDefinitionImporter documentDefinitionImporter(
        JsonSchemaDocumentDefinitionService jsonSchemaDocumentDefinitionService
    ) {
        return new CaseJsonSchemaDocumentDefinitionImporter(
            jsonSchemaDocumentDefinitionService
        );
    }

    @Bean
    @ConditionalOnMissingBean(DocumentSequenceGeneratorService.class)
    public JsonSchemaDocumentDefinitionSequenceGeneratorService documentSequenceGeneratorService(
        final DocumentDefinitionSequenceRepository<JsonSchemaDocumentDefinitionSequenceRecord> documentDefinitionSequenceRepository
    ) {
        return new JsonSchemaDocumentDefinitionSequenceGeneratorService(documentDefinitionSequenceRepository);
    }

    @Bean
    @ConditionalOnMissingBean(DocumentSearchService.class)
    public JsonSchemaDocumentSearchService documentSearchService(
        final EntityManager entityManager,
        final QueryDialectHelper queryDialectHelper,
        final SearchFieldService searchFieldService,
        final UserManagementService userManagementService,
        final Optional<TeamManagementService> teamManagementService,
        final AuthorizationService authorizationService,
        final OutboxService outboxService,
        final JsonSchemaDocumentDefinitionService jsonSchemaDocumentDefinitionService,
        final ObjectMapper objectMapper
    ) {
        return new JsonSchemaDocumentSearchService(
            entityManager,
            queryDialectHelper,
            searchFieldService,
            userManagementService,
            teamManagementService.orElse(null),
            authorizationService,
            outboxService,
            jsonSchemaDocumentDefinitionService,
            objectMapper
        );
    }

    @Bean
    @ConditionalOnMissingBean(RelatedJsonSchemaDocumentAvailableEventListenerImpl.class)
    public RelatedJsonSchemaDocumentAvailableEventListenerImpl relatedDocumentAvailableEventListener(
        final DocumentService documentService
    ) {
        return new RelatedJsonSchemaDocumentAvailableEventListenerImpl(documentService);
    }

    @Bean
    @ConditionalOnMissingBean(DocumentRelatedFileSubmittedEventListenerImpl.class)
    public DocumentRelatedFileSubmittedEventListenerImpl documentRelatedFileSubmittedEventListener(
        final DocumentService documentService,
        final Optional<ResourceService> resourceServiceOpt
    ) {
        return new DocumentRelatedFileSubmittedEventListenerImpl(documentService, resourceServiceOpt);
    }

    //API
    @Bean
    @ConditionalOnMissingBean(DocumentDefinitionResource.class)
    public JsonSchemaDocumentDefinitionResource documentDefinitionResource(
        final DocumentDefinitionService documentDefinitionService,
        final DocumentStatisticService documentStatisticService
    ) {
        return new JsonSchemaDocumentDefinitionResource(
            documentDefinitionService,
            documentStatisticService
        );
    }

    @Bean
    @ConditionalOnMissingBean(DocumentResource.class)
    public JsonSchemaDocumentResource documentResource(
        DocumentService documentService
    ) {
        return new JsonSchemaDocumentResource(documentService);
    }

    @Bean
    @ConditionalOnMissingBean(DocumentDefinitionManagementResource.class)
    public DocumentDefinitionManagementResource documentDefinitionManagementResource(
        DocumentDefinitionService documentDefinitionService
    ) {
        return new DocumentDefinitionManagementResource(documentDefinitionService);
    }

    @Bean
    @ConditionalOnMissingBean(DocumentSearchResource.class)
    public JsonSchemaDocumentSearchResource documentSearchResource(DocumentSearchService documentSearchService) {
        return new JsonSchemaDocumentSearchResource(documentSearchService);
    }

    @Bean("documentSpringContextHelper")
    @ConditionalOnMissingBean(DocumentSpringContextHelper.class)
    public DocumentSpringContextHelper documentSpringContextHelper() {
        return new DocumentSpringContextHelper();
    }

    @Bean
    @ConditionalOnMissingBean(ValidationExceptionMapper.class)
    public ValidationExceptionMapper validationExceptionMapper() {
        return new ValidationExceptionMapper();
    }

    @Bean
    @ConditionalOnMissingBean(DocumentDefinitionCaseEventListener.class)
    public DocumentDefinitionCaseEventListener documentDefinitionCaseEventListener(
        DocumentDefinitionService documentDefinitionService
    ) {
        return new DocumentDefinitionCaseEventListener(
            documentDefinitionService
        );
    }

    @Bean
    @ConditionalOnMissingBean(JsonSchemaDocumentTeamChangedListener.class)
    public JsonSchemaDocumentTeamChangedListener jsonSchemaDocumentTeamChangedListener(
        JsonSchemaDocumentRepository jsonSchemaDocumentRepository
    ) {
        return new JsonSchemaDocumentTeamChangedListener(
            jsonSchemaDocumentRepository
        );
    }
}
