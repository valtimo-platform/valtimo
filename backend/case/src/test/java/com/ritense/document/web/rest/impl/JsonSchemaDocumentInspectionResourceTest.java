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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ritense.authorization.AuthorizationService;
import com.ritense.authorization.request.EntityAuthorizationRequest;
import com.ritense.document.BaseTest;
import com.ritense.document.domain.impl.JsonDocumentContent;
import com.ritense.document.domain.impl.JsonSchemaDocument;
import com.ritense.document.domain.impl.request.ModifyDocumentRequest;
import com.ritense.document.event.JsonSchemaDocumentInspectionEditedEvent;
import com.ritense.document.exception.DocumentNotFoundException;
import com.ritense.document.service.DocumentService;
import com.ritense.document.service.JsonSchemaDocumentActionProvider;
import com.ritense.document.service.result.ModifyDocumentResult;
import com.ritense.document.web.rest.dto.DocumentInspectionDto;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class JsonSchemaDocumentInspectionResourceTest extends BaseTest {

    private DocumentService documentService;
    private AuthorizationService authorizationService;
    private ApplicationEventPublisher eventPublisher;
    private JsonSchemaDocumentInspectionResource resource;
    private JsonSchemaDocument document;

    @BeforeEach
    void setUp() {
        documentService = mock(DocumentService.class);
        authorizationService = mock(AuthorizationService.class);
        eventPublisher = mock(ApplicationEventPublisher.class);
        resource = new JsonSchemaDocumentInspectionResource(documentService, authorizationService, eventPublisher);

        document = JsonSchemaDocument.create(
            definitionOfForUnitTests("person"),
            new JsonDocumentContent("{\"firstName\":\"John\"}"),
            USERNAME,
            documentSequenceGeneratorService,
            null
        ).resultingDocument().orElseThrow();
    }

    @Test
    void getForInspectionShouldRequireInspectPermissionAndReturnContent() {
        UUID caseId = UUID.randomUUID();
        doReturn(Optional.of(document)).when(documentService).findBy(any());

        ResponseEntity<DocumentInspectionDto> response = resource.getForInspection(caseId);

        verify(authorizationService).requirePermission(argThat(request ->
            request instanceof EntityAuthorizationRequest<?>
                && ((EntityAuthorizationRequest<?>) request).getAction()
                    .equals(JsonSchemaDocumentActionProvider.INSPECT)
        ));
        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().content()).isNotNull();
        assertThat(response.getBody().content().get("firstName").asText()).isEqualTo("John");
    }

    @Test
    void getForInspectionShouldThrowWhenDocumentMissing() {
        doReturn(Optional.empty()).when(documentService).findBy(any());

        assertThatThrownBy(() -> resource.getForInspection(UUID.randomUUID()))
            .isInstanceOf(DocumentNotFoundException.class);

        verify(authorizationService, never()).requirePermission(any());
    }

    @Test
    void modifyForInspectionShouldRequireInspectModifyPermissionAndPublishEvent() throws Exception {
        UUID caseId = document.id().getId();
        doReturn(Optional.of(document)).when(documentService).findBy(any());

        var newJson = new ObjectMapper().readTree("{\"firstName\":\"Jane\"}");
        var modifyRequest = new ModifyDocumentRequest(document.id().toString(), newJson);

        JsonSchemaDocument updated = JsonSchemaDocument.create(
            definitionOfForUnitTests("person"),
            new JsonDocumentContent("{\"firstName\":\"Jane\"}"),
            USERNAME,
            documentSequenceGeneratorService,
            null
        ).resultingDocument().orElseThrow();

        var modifyResult = new JsonSchemaDocument.ModifyDocumentResultImpl(updated);
        when(documentService.modifyDocument(any(ModifyDocumentRequest.class))).thenReturn(modifyResult);

        ResponseEntity<ModifyDocumentResult> response = resource.modifyForInspection(caseId, modifyRequest);

        verify(authorizationService).requirePermission(argThat(request ->
            request instanceof EntityAuthorizationRequest<?>
                && ((EntityAuthorizationRequest<?>) request).getAction()
                    .equals(JsonSchemaDocumentActionProvider.INSPECT_MODIFY)
        ));
        ArgumentCaptor<JsonSchemaDocumentInspectionEditedEvent> eventCaptor =
            ArgumentCaptor.forClass(JsonSchemaDocumentInspectionEditedEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        var published = eventCaptor.getValue();
        assertThat(published.getDocumentId()).isEqualTo(caseId);
        assertThat(published.getNewContent()).contains("Jane");
        assertThat(published.getPreviousContent()).contains("John");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void modifyForInspectionShouldReturnBadRequestAndNotPublishEventWhenServiceFails() throws Exception {
        UUID caseId = document.id().getId();
        doReturn(Optional.of(document)).when(documentService).findBy(any());

        var newJson = new ObjectMapper().readTree("{\"firstName\":\"Jane\"}");
        var modifyRequest = new ModifyDocumentRequest(document.id().toString(), newJson);

        var failedResult = new JsonSchemaDocument.ModifyDocumentResultImpl(java.util.List.of());
        when(documentService.modifyDocument(any(ModifyDocumentRequest.class))).thenReturn(failedResult);

        ResponseEntity<ModifyDocumentResult> response = resource.modifyForInspection(caseId, modifyRequest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(eventPublisher, never()).publishEvent(any(JsonSchemaDocumentInspectionEditedEvent.class));
    }

    @Test
    void modifyForInspectionShouldPropagateAuthorizationFailureWithoutModifying() {
        UUID caseId = document.id().getId();
        doReturn(Optional.of(document)).when(documentService).findBy(any());
        doThrow(new RuntimeException("denied")).when(authorizationService).requirePermission(any());

        var newJson = new ObjectMapper().createObjectNode().put("firstName", "Jane");
        var modifyRequest = new ModifyDocumentRequest(document.id().toString(), newJson);

        assertThatThrownBy(() -> resource.modifyForInspection(caseId, modifyRequest))
            .isInstanceOf(RuntimeException.class)
            .hasMessage("denied");

        verify(documentService, never()).modifyDocument(any(ModifyDocumentRequest.class));
        verify(eventPublisher, never()).publishEvent(any(JsonSchemaDocumentInspectionEditedEvent.class));
    }

    @Test
    void modifyForInspectionShouldRejectWhenPathAndBodyDocumentIdsMismatch() {
        var newJson = new ObjectMapper().createObjectNode().put("firstName", "Jane");
        var modifyRequest = new ModifyDocumentRequest(document.id().toString(), newJson);
        UUID differentCaseId = UUID.randomUUID();

        assertThatThrownBy(() -> resource.modifyForInspection(differentCaseId, modifyRequest))
            .isInstanceOf(IllegalArgumentException.class);

        verify(authorizationService, never()).requirePermission(any());
        verify(documentService, never()).modifyDocument(any(ModifyDocumentRequest.class));
        verify(eventPublisher, never()).publishEvent(any(JsonSchemaDocumentInspectionEditedEvent.class));
    }
}
