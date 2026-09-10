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

package com.ritense.document.web.rest.impl;

import static com.ritense.authorization.AuthorizationContext.runWithoutAuthorization;
import static com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE;

import com.ritense.authorization.AuthorizationService;
import com.ritense.authorization.request.EntityAuthorizationRequest;
import com.ritense.document.domain.impl.JsonSchemaDocument;
import com.ritense.document.domain.impl.JsonSchemaDocumentId;
import com.ritense.document.domain.impl.request.ModifyDocumentRequest;
import com.ritense.document.event.JsonSchemaDocumentInspectionEditedEvent;
import com.ritense.document.exception.DocumentNotFoundException;
import com.ritense.document.service.DocumentService;
import com.ritense.document.service.JsonSchemaDocumentActionProvider;
import com.ritense.document.service.result.ModifyDocumentResult;
import com.ritense.document.web.rest.dto.DocumentInspectionDto;
import com.ritense.logging.LoggableResource;
import com.ritense.valtimo.contract.annotation.SkipComponentScan;
import com.ritense.valtimo.contract.audit.utils.AuditHelper;
import com.ritense.valtimo.contract.endpoint.EndpointDescription;
import com.ritense.valtimo.contract.utils.RequestHelper;
import jakarta.validation.Valid;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@SkipComponentScan
@RequestMapping(value = "/api/management", produces = APPLICATION_JSON_UTF8_VALUE)
public class JsonSchemaDocumentInspectionResource {

    private final DocumentService documentService;
    private final AuthorizationService authorizationService;
    private final ApplicationEventPublisher eventPublisher;

    public JsonSchemaDocumentInspectionResource(
        DocumentService documentService,
        AuthorizationService authorizationService,
        ApplicationEventPublisher eventPublisher
    ) {
        this.documentService = documentService;
        this.authorizationService = authorizationService;
        this.eventPublisher = eventPublisher;
    }

    @EndpointDescription(
        en = "Get case for inspection",
        nl = "Dossier voor inspectie ophalen"
    )
    @GetMapping("/v1/case/{caseId}")
    public ResponseEntity<DocumentInspectionDto> getForInspection(
        @LoggableResource(resourceType = JsonSchemaDocument.class) @PathVariable("caseId") UUID caseId
    ) {
        JsonSchemaDocument document = loadDocument(caseId);
        authorizationService.requirePermission(
            new EntityAuthorizationRequest<>(
                JsonSchemaDocument.class,
                JsonSchemaDocumentActionProvider.INSPECT,
                document
            )
        );
        return ResponseEntity.ok(DocumentInspectionDto.from(document));
    }

    @EndpointDescription(
        en = "Modify case for inspection",
        nl = "Dossier voor inspectie bijwerken"
    )
    @PutMapping("/v1/case/{caseId}")
    public ResponseEntity<ModifyDocumentResult> modifyForInspection(
        @LoggableResource(resourceType = JsonSchemaDocument.class) @PathVariable("caseId") UUID caseId,
        @RequestBody @Valid ModifyDocumentRequest request
    ) {
        if (!caseId.toString().equals(request.documentId())) {
            throw new IllegalArgumentException(
                "Document id in request body does not match case id in path"
            );
        }
        JsonSchemaDocument document = loadDocument(caseId);
        authorizationService.requirePermission(
            new EntityAuthorizationRequest<>(
                JsonSchemaDocument.class,
                JsonSchemaDocumentActionProvider.INSPECT_MODIFY,
                document
            )
        );

        var previousContent = document.content().asJson().toString();
        var result = runWithoutAuthorization(() -> documentService.modifyDocument(request));

        result.resultingDocument().ifPresent(updatedDocument ->
            eventPublisher.publishEvent(new JsonSchemaDocumentInspectionEditedEvent(
                UUID.randomUUID(),
                RequestHelper.getOrigin(),
                LocalDateTime.now(),
                AuditHelper.getActor(),
                caseId,
                previousContent,
                updatedDocument.content().asJson().toString()
            ))
        );

        var httpStatus = result.resultingDocument().isPresent() ? HttpStatus.OK : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(httpStatus).body(result);
    }

    private JsonSchemaDocument loadDocument(UUID caseId) {
        return (JsonSchemaDocument) runWithoutAuthorization(
            () -> documentService.findBy(JsonSchemaDocumentId.existingId(caseId))
                .orElseThrow(() -> new DocumentNotFoundException("Case not found with id " + caseId))
        );
    }
}
