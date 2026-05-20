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
import com.ritense.logging.service.LoggingEventService
import com.ritense.logging.web.rest.dto.LoggingEventPropertyDto
import com.ritense.logging.web.rest.dto.LoggingEventSearchRequest
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
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class LogInspectionResourceTest {

    private lateinit var documentService: DocumentService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var loggingEventService: LoggingEventService
    private lateinit var resource: LogInspectionResource

    private val caseId: UUID = UUID.randomUUID()
    private val caseKey: String = JsonSchemaDocument::class.java.canonicalName

    @BeforeEach
    fun setUp() {
        documentService = mock()
        authorizationService = mock()
        loggingEventService = mock()

        resource = LogInspectionResource(
            documentService = documentService,
            authorizationService = authorizationService,
            loggingEventService = loggingEventService,
        )

        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.of(mock<JsonSchemaDocument>()))
        whenever(loggingEventService.searchLoggingEvents(any(), any()))
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
    fun `should propagate authorization failure without querying logs`() {
        doThrow(RuntimeException("denied")).whenever(authorizationService)
            .requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())

        assertThrows<RuntimeException> {
            resource.searchCaseLogs(caseId, LogInspectionSearchRequest(), PageRequest.of(0, 20))
        }

        verify(loggingEventService, never()).searchLoggingEvents(any(), any())
    }

    @Test
    fun `should always pin the JsonSchemaDocument property to this case`() {
        resource.searchCaseLogs(caseId, LogInspectionSearchRequest(), PageRequest.of(0, 20))

        val captor = argumentCaptor<LoggingEventSearchRequest>()
        verify(loggingEventService).searchLoggingEvents(captor.capture(), any())

        val properties = captor.firstValue.properties
        assertEquals(1, properties.size)
        assertEquals(caseKey, properties.single().key)
        assertEquals(caseId.toString(), properties.single().value)
    }

    @Test
    fun `should append additional properties on top of the case pin`() {
        val extra = LoggingEventPropertyDto("processInstanceId", "pi-123")

        resource.searchCaseLogs(
            caseId,
            LogInspectionSearchRequest(additionalProperties = listOf(extra)),
            PageRequest.of(0, 20),
        )

        val captor = argumentCaptor<LoggingEventSearchRequest>()
        verify(loggingEventService).searchLoggingEvents(captor.capture(), any())

        val properties = captor.firstValue.properties
        assertEquals(2, properties.size)
        assertTrue(properties.contains(extra))
        assertTrue(properties.any { it.key == caseKey && it.value == caseId.toString() })
    }

    @Test
    fun `should overwrite a client-supplied JsonSchemaDocument filter with this case`() {
        val otherCase = UUID.randomUUID()
        val tampered = LoggingEventPropertyDto(caseKey, otherCase.toString())

        resource.searchCaseLogs(
            caseId,
            LogInspectionSearchRequest(additionalProperties = listOf(tampered)),
            PageRequest.of(0, 20),
        )

        val captor = argumentCaptor<LoggingEventSearchRequest>()
        verify(loggingEventService).searchLoggingEvents(captor.capture(), any())

        val properties = captor.firstValue.properties
        assertEquals(1, properties.size)
        assertEquals(caseKey, properties.single().key)
        assertEquals(caseId.toString(), properties.single().value)
    }

    @Test
    fun `should forward level message and time range filters as-is`() {
        val after = LocalDateTime.parse("2026-05-01T00:00:00")
        val before = LocalDateTime.parse("2026-05-20T00:00:00")

        resource.searchCaseLogs(
            caseId,
            LogInspectionSearchRequest(
                level = "WARN",
                likeFormattedMessage = "boom",
                afterTimestamp = after,
                beforeTimestamp = before,
            ),
            PageRequest.of(0, 20),
        )

        val captor = argumentCaptor<LoggingEventSearchRequest>()
        verify(loggingEventService).searchLoggingEvents(captor.capture(), eq(PageRequest.of(0, 20)))

        val req = captor.firstValue
        assertEquals("WARN", req.level)
        assertEquals("boom", req.likeFormattedMessage)
        assertEquals(after, req.afterTimestamp)
        assertEquals(before, req.beforeTimestamp)
    }
}
