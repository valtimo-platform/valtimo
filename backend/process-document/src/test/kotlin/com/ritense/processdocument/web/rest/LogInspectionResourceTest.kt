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

package com.ritense.processdocument.web.rest

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.DocumentService
import com.ritense.logging.domain.LoggingEvent
import com.ritense.logging.scope.CaseLogScopeContributor
import com.ritense.logging.scope.MdcScopeEntry
import com.ritense.logging.service.LoggingEventService
import com.ritense.processdocument.web.rest.dto.LogInspectionSearchRequest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.jpa.domain.Specification
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals

class LogInspectionResourceTest {

    private lateinit var documentService: DocumentService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var loggingEventService: LoggingEventService
    private lateinit var contributorA: CaseLogScopeContributor
    private lateinit var contributorB: CaseLogScopeContributor
    private lateinit var resource: LogInspectionResource

    private val caseId: UUID = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        documentService = mock()
        authorizationService = mock()
        loggingEventService = mock()
        contributorA = mock()
        contributorB = mock()

        resource = LogInspectionResource(
            documentService = documentService,
            authorizationService = authorizationService,
            loggingEventService = loggingEventService,
            scopeContributors = listOf(contributorA, contributorB),
        )

        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.of(mock<JsonSchemaDocument>()))
        whenever(contributorA.scopeFor(any())).thenReturn(emptyList())
        whenever(contributorB.scopeFor(any())).thenReturn(emptyList())
        whenever(loggingEventService.searchLoggingEvents(any<Specification<LoggingEvent>>(), any()))
            .thenReturn(PageImpl(emptyList<LoggingEvent>()))
    }

    @Test
    fun `should require INSPECT permission on the document`() {
        resource.searchCaseLogs(caseId, LogInspectionSearchRequest(), PageRequest.of(0, 20))

        val captor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertEquals(JsonSchemaDocument::class.java, captor.firstValue.resourceType)
    }

    @Test
    fun `should propagate authorization failure without invoking contributors or service`() {
        doThrow(RuntimeException("denied")).whenever(authorizationService)
            .requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())

        assertThrows<RuntimeException> {
            resource.searchCaseLogs(caseId, LogInspectionSearchRequest(), PageRequest.of(0, 20))
        }

        verify(contributorA, never()).scopeFor(any())
        verify(contributorB, never()).scopeFor(any())
        verify(loggingEventService, never()).searchLoggingEvents(any<Specification<LoggingEvent>>(), any())
    }

    @Test
    fun `should call every registered contributor with the inspected case id`() {
        whenever(contributorA.scopeFor(caseId))
            .thenReturn(listOf(MdcScopeEntry("processInstanceId", listOf("pi-1"))))
        whenever(contributorB.scopeFor(caseId))
            .thenReturn(listOf(MdcScopeEntry("com.ritense.document.domain.impl.JsonSchemaDocument", listOf("bb-doc-1"))))

        resource.searchCaseLogs(caseId, LogInspectionSearchRequest(), PageRequest.of(0, 20))

        verify(contributorA).scopeFor(caseId)
        verify(contributorB).scopeFor(caseId)
    }

    @Test
    fun `should dispatch to the spec-based searchLoggingEvents overload with the supplied pageable`() {
        val pageable = PageRequest.of(2, 50)

        resource.searchCaseLogs(caseId, LogInspectionSearchRequest(), pageable)

        verify(loggingEventService).searchLoggingEvents(any<Specification<LoggingEvent>>(), eq(pageable))
    }
}
