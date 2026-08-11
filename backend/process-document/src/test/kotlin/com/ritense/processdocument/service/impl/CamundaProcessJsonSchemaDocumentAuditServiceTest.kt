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

package com.ritense.processdocument.service.impl

import com.ritense.audit.service.AuditService
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.processdocument.event.ProcessTimerSkippedEvent
import com.ritense.valtimo.contract.audit.AuditEvent
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class CamundaProcessJsonSchemaDocumentAuditServiceTest {

    private lateinit var auditService: AuditService
    private lateinit var documentService: JsonSchemaDocumentService
    private lateinit var authorizationService: AuthorizationService

    private lateinit var service: CamundaProcessJsonSchemaDocumentAuditService

    @BeforeEach
    fun setUp() {
        auditService = mock()
        documentService = mock()
        authorizationService = mock()

        service = CamundaProcessJsonSchemaDocumentAuditService(
            auditService,
            documentService,
            authorizationService,
        )
    }

    @Test
    fun `getAuditLog requires VIEW permission and includes ProcessTimerSkippedEvent in the queried event types`() {
        val documentId = UUID.randomUUID()
        val id = JsonSchemaDocumentId.existingId(documentId)
        whenever(documentService.getDocumentBy(any())).thenReturn(mock<JsonSchemaDocument>())
        whenever(auditService.findByEventAndDocumentId(any(), any(), any())).thenReturn(Page.empty())

        service.getAuditLog(id, PageRequest.of(0, 10))

        val permissionCaptor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(permissionCaptor.capture())
        assertEquals(JsonSchemaDocumentActionProvider.VIEW, permissionCaptor.firstValue.action)

        val eventTypesCaptor = argumentCaptor<List<Class<out AuditEvent>>>()
        verify(auditService).findByEventAndDocumentId(eventTypesCaptor.capture(), any(), any())
        assertTrue(
            eventTypesCaptor.firstValue.contains(ProcessTimerSkippedEvent::class.java),
            "ProcessTimerSkippedEvent should be part of the audited event types"
        )
    }
}
