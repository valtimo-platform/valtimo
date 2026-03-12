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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.processdocument.service.impl

import com.ritense.audit.service.AuditService
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.impl.JsonSchemaDocumentService
import com.ritense.processdocument.domain.event.TestEvent
import com.ritense.processdocument.service.DocumentAuditEventProvider
import com.ritense.valtimo.contract.audit.AuditEvent
import com.ritense.valtimo.contract.audit.AuditMetaData
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import java.time.LocalDateTime
import java.util.UUID

internal class OperatonProcessJsonSchemaDocumentAuditServiceTest {

    private lateinit var auditService: AuditService
    private lateinit var documentService: JsonSchemaDocumentService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var document: JsonSchemaDocument
    private lateinit var documentId: JsonSchemaDocumentId

    @BeforeEach
    fun setUp() {
        auditService = mock()
        documentService = mock()
        authorizationService = mock()
        document = mock()
        documentId = JsonSchemaDocumentId.existingId(UUID.randomUUID())

        whenever(documentService.getDocumentBy(documentId)).thenReturn(document)
        whenever(auditService.findByEventAndDocumentId(
            org.mockito.kotlin.any<List<Class<out AuditEvent>>>(),
            org.mockito.kotlin.any<UUID>(),
            org.mockito.kotlin.any<Pageable>(),
        )).thenReturn(PageImpl(emptyList()))
    }

    @Test
    fun `getAuditLog should pass event types from provider to audit service`() {
        val provider = DocumentAuditEventProvider { listOf(TestEvent::class.java) }
        val service = buildService(listOf(provider))

        service.getAuditLog(documentId, Pageable.unpaged())

        val eventTypesCaptor = argumentCaptor<List<Class<out AuditEvent>>>()
        verify(auditService).findByEventAndDocumentId(
            eventTypesCaptor.capture(),
            org.mockito.kotlin.any<UUID>(),
            org.mockito.kotlin.any<Pageable>(),
        )
        assertThat(eventTypesCaptor.firstValue).containsExactly(TestEvent::class.java)
    }

    @Test
    fun `getAuditLog should merge event types from multiple providers`() {
        val provider1 = DocumentAuditEventProvider { listOf(TestEvent::class.java) }
        val provider2 = DocumentAuditEventProvider { listOf(CustomEvent::class.java) }
        val service = buildService(listOf(provider1, provider2))

        service.getAuditLog(documentId, Pageable.unpaged())

        val eventTypesCaptor = argumentCaptor<List<Class<out AuditEvent>>>()
        verify(auditService).findByEventAndDocumentId(
            eventTypesCaptor.capture(),
            org.mockito.kotlin.any<UUID>(),
            org.mockito.kotlin.any<Pageable>(),
        )
        assertThat(eventTypesCaptor.firstValue).containsExactlyInAnyOrder(
            TestEvent::class.java,
            CustomEvent::class.java,
        )
    }

    @Test
    fun `getAuditLog with default provider should pass all 15 built-in event types`() {
        val service = buildService(listOf(DefaultDocumentAuditEventProvider()))

        service.getAuditLog(documentId, Pageable.unpaged())

        val eventTypesCaptor = argumentCaptor<List<Class<out AuditEvent>>>()
        verify(auditService).findByEventAndDocumentId(
            eventTypesCaptor.capture(),
            org.mockito.kotlin.any<UUID>(),
            org.mockito.kotlin.any<Pageable>(),
        )
        assertThat(eventTypesCaptor.firstValue).hasSize(15)
    }

    @Test
    fun `getAuditLog should pass the document UUID to audit service`() {
        val service = buildService(listOf(DocumentAuditEventProvider { emptyList() }))

        service.getAuditLog(documentId, Pageable.unpaged())

        val uuidCaptor = argumentCaptor<UUID>()
        verify(auditService).findByEventAndDocumentId(
            org.mockito.kotlin.any<List<Class<out AuditEvent>>>(),
            uuidCaptor.capture(),
            org.mockito.kotlin.any<Pageable>(),
        )
        assertThat(uuidCaptor.firstValue).isEqualTo(UUID.fromString(documentId.toString()))
    }

    @Test
    fun `getAuditLog should check authorization for the document`() {
        val service = buildService(listOf(DocumentAuditEventProvider { emptyList() }))

        service.getAuditLog(documentId, Pageable.unpaged())

        verify(authorizationService).requirePermission(org.mockito.kotlin.any<AuthorizationRequest<JsonSchemaDocument>>())
    }

    private fun buildService(providers: List<DocumentAuditEventProvider>) =
        OperatonProcessJsonSchemaDocumentAuditService(
            auditService,
            documentService,
            authorizationService,
            providers,
        )

    /** Stub event class used to test extensibility without depending on specific built-in events. */
    private class CustomEvent(
        id: UUID,
        origin: String,
        occurredOn: LocalDateTime,
        user: String,
    ) : AuditMetaData(id, origin, occurredOn, user), AuditEvent
}
