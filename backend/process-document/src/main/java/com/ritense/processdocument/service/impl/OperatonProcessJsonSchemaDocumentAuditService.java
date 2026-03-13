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

package com.ritense.processdocument.service.impl;

import static com.ritense.document.service.JsonSchemaDocumentActionProvider.VIEW;

import com.ritense.audit.domain.AuditRecord;
import com.ritense.audit.service.AuditService;
import com.ritense.authorization.AuthorizationContext;
import com.ritense.authorization.AuthorizationService;
import com.ritense.authorization.request.EntityAuthorizationRequest;
import com.ritense.document.domain.Document;
import com.ritense.document.domain.impl.JsonSchemaDocument;
import com.ritense.document.service.impl.JsonSchemaDocumentService;
import com.ritense.processdocument.service.DocumentAuditEventProvider;
import com.ritense.processdocument.service.ProcessDocumentAuditService;
import com.ritense.valtimo.contract.audit.AuditEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public class OperatonProcessJsonSchemaDocumentAuditService implements ProcessDocumentAuditService {

    private final AuditService auditService;
    private final JsonSchemaDocumentService documentService;
    private final AuthorizationService authorizationService;
    private final List<DocumentAuditEventProvider> auditEventProviders;

    public OperatonProcessJsonSchemaDocumentAuditService(
        AuditService auditService,
        JsonSchemaDocumentService documentService,
        AuthorizationService authorizationService,
        List<DocumentAuditEventProvider> auditEventProviders
    ) {
        this.auditService = auditService;
        this.documentService = documentService;
        this.authorizationService = authorizationService;
        this.auditEventProviders = auditEventProviders;
    }

    @Override
    public Page<AuditRecord> getAuditLog(
        final Document.Id id,
        final Pageable pageable
    ) {
        final List<Class<? extends AuditEvent>> eventTypes = auditEventProviders.stream()
            .flatMap(provider -> provider.getAuditEventTypes().stream())
            .toList();

        final var document = documentService.getDocumentBy(id);
        authorizationService.requirePermission(
            new EntityAuthorizationRequest<>(
                JsonSchemaDocument.class,
                VIEW,
                document
            )
        );

        return AuthorizationContext.runWithoutAuthorization(() ->
            auditService.findByEventAndDocumentId(eventTypes, UUID.fromString(id.toString()), pageable));
    }

}