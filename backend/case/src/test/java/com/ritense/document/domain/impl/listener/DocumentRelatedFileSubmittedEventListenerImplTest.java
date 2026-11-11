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

package com.ritense.document.domain.impl.listener;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ritense.document.service.DocumentService;
import com.ritense.resource.service.ResourceService;
import com.ritense.valtimo.contract.document.event.DocumentRelatedFileSubmittedEvent;
import com.ritense.valtimo.contract.resource.Resource;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

class DocumentRelatedFileSubmittedEventListenerImplTest {

    private DocumentService documentService;
    private ResourceService resourceService;
    private DocumentRelatedFileSubmittedEventListenerImpl listener;

    @BeforeEach
    void setUp() {
        documentService = mock(DocumentService.class);
        resourceService = mock(ResourceService.class);
        listener = new DocumentRelatedFileSubmittedEventListenerImpl(documentService, Optional.of(resourceService));
    }

    @Test
    void handleClaimsResourceBeforeLinking() {
        UUID documentId = UUID.randomUUID();
        UUID resourceId = UUID.randomUUID();
        Resource resource = mock(Resource.class);
        when(resource.id()).thenReturn(resourceId);
        when(resource.name()).thenReturn("name.txt");
        when(resource.extension()).thenReturn("txt");
        when(resource.sizeInBytes()).thenReturn(1L);
        when(resource.createdOn()).thenReturn(LocalDateTime.now());
        when(resourceService.getResource(resourceId)).thenReturn(resource);

        listener.handle(new DocumentRelatedFileSubmittedEvent(documentId, resourceId, "def"));

        var order = inOrder(resourceService, documentService);
        order.verify(resourceService).claimForDocument(resourceId, documentId);
        order.verify(resourceService).getResource(resourceId);
        order.verify(documentService).assignRelatedFile(any(), any());
    }

    @Test
    void handleLinksNothingWhenClaimIsDenied() {
        UUID documentId = UUID.randomUUID();
        UUID resourceId = UUID.randomUUID();
        doThrow(new AccessDeniedException("Access denied"))
            .when(resourceService).claimForDocument(resourceId, documentId);

        assertThrows(
            AccessDeniedException.class,
            () -> listener.handle(new DocumentRelatedFileSubmittedEvent(documentId, resourceId, "def"))
        );

        verify(resourceService, never()).getResource(resourceId);
        verify(documentService, never()).assignRelatedFile(any(), any());
    }
}
