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

package com.ritense.processdocument.service

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.DocumentService
import com.ritense.document.service.JsonSchemaDocumentActionProvider
import com.ritense.processdocument.domain.ProcessDocumentInstanceId
import com.ritense.processdocument.domain.ProcessInstanceId
import com.ritense.processdocument.domain.impl.ProcessDocumentInstanceDto
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.Mockito.RETURNS_DEEP_STUBS
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.runtime.ProcessInstance
import org.springframework.web.server.ResponseStatusException
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertSame

class ProcessInstanceCaseAccessServiceTest {

    private lateinit var documentService: DocumentService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var processDocumentAssociationService: ProcessDocumentAssociationService
    private lateinit var runtimeService: RuntimeService

    private lateinit var service: ProcessInstanceCaseAccessService

    private val caseId: UUID = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        documentService = mock()
        authorizationService = mock()
        processDocumentAssociationService = mock()
        runtimeService = mock(defaultAnswer = RETURNS_DEEP_STUBS)

        service = ProcessInstanceCaseAccessService(
            documentService,
            authorizationService,
            processDocumentAssociationService,
            runtimeService,
        )
    }

    @Test
    fun `loadAndAuthorize returns the document and requires the given action`() {
        val document = mock<JsonSchemaDocument>()
        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.of(document))

        val result = service.loadAndAuthorize(caseId, JsonSchemaDocumentActionProvider.INSPECT)

        assertSame(document, result)
        val captor = argumentCaptor<EntityAuthorizationRequest<JsonSchemaDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertEquals(JsonSchemaDocument::class.java, captor.firstValue.resourceType)
        assertEquals(JsonSchemaDocumentActionProvider.INSPECT, captor.firstValue.action)
    }

    @Test
    fun `loadAndAuthorize propagates authorization failure`() {
        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.of(mock<JsonSchemaDocument>()))
        doThrow(RuntimeException("denied")).whenever(authorizationService)
            .requirePermission(any<AuthorizationRequest<JsonSchemaDocument>>())

        assertThrows<RuntimeException> {
            service.loadAndAuthorize(caseId, JsonSchemaDocumentActionProvider.INSPECT)
        }
    }

    @Test
    fun `requireBelongsToCase passes when the process instance is associated with the case`() {
        val processInstanceId = UUID.randomUUID().toString()
        val dto = instanceDto(processInstanceId)
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(listOf(dto))

        service.requireBelongsToCase(caseId, processInstanceId)
    }

    @Test
    fun `requireBelongsToCase throws 404 when the process instance is not associated with the case`() {
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(emptyList())

        val ex = assertThrows<ResponseStatusException> {
            service.requireBelongsToCase(caseId, "unknown-pid")
        }
        assertEquals(404, ex.statusCode.value())
    }

    @Test
    fun `requireActive passes when the process instance is active`() {
        val processInstanceId = UUID.randomUUID().toString()
        whenever(
            runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult()
        ).thenReturn(mock<ProcessInstance>())

        service.requireActive(processInstanceId)
    }

    @Test
    fun `requireActive throws 404 when the process instance is not active`() {
        val processInstanceId = UUID.randomUUID().toString()
        whenever(
            runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult()
        ).thenReturn(null)

        val ex = assertThrows<ResponseStatusException> {
            service.requireActive(processInstanceId)
        }
        assertEquals(404, ex.statusCode.value())
    }

    private fun instanceDto(processInstanceId: String): ProcessDocumentInstanceDto {
        val pInstanceId = mock<ProcessInstanceId>()
        whenever(pInstanceId.toString()).thenReturn(processInstanceId)
        val id = mock<ProcessDocumentInstanceId>()
        whenever(id.processInstanceId()).thenReturn(pInstanceId)
        return ProcessDocumentInstanceDto(id, "p", true, 1, 1, null, null)
    }
}
