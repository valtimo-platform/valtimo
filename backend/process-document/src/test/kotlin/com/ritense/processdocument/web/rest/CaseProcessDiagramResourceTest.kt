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
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.ProcessDocumentInstanceId
import com.ritense.processdocument.domain.ProcessInstanceId
import com.ritense.processdocument.domain.impl.ProcessDocumentInstanceDto
import com.ritense.processdocument.service.ProcessDocumentAssociationService
import com.ritense.processdocument.service.ProcessInstanceCaseAccessService
import com.ritense.valtimo.service.ProcessInstanceDiagramService
import com.ritense.valtimo.web.rest.dto.ProcessInstanceDiagramDto
import java.util.Optional
import java.util.UUID
import kotlin.test.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.server.ResponseStatusException

class CaseProcessDiagramResourceTest {

    private lateinit var authorizationService: AuthorizationService
    private lateinit var documentService: DocumentService
    private lateinit var processDocumentAssociationService: ProcessDocumentAssociationService
    private lateinit var diagramService: ProcessInstanceDiagramService

    private lateinit var resource: CaseProcessDiagramResource

    private val caseId: UUID = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        authorizationService = mock()
        documentService = mock()
        processDocumentAssociationService = mock()
        diagramService = mock()

        val caseAccessService = ProcessInstanceCaseAccessService(processDocumentAssociationService)

        resource = CaseProcessDiagramResource(
            caseAccessService = caseAccessService,
            documentService = documentService,
            authorizationService = authorizationService,
            processInstanceDiagramService = diagramService,
        )
    }

    @Test
    fun `should return the diagram when the user may view the case`() {
        val processInstanceId = associateInstance()
        allowDocumentView()
        val diagram = mock<ProcessInstanceDiagramDto>()
        whenever(diagramService.getProcessInstanceDiagram(processInstanceId)).thenReturn(diagram)

        val response = resource.getProcessInstanceDiagram(caseId, processInstanceId)

        assertEquals(200, response.statusCode.value())
        assertEquals(diagram, response.body)
    }

    @Test
    fun `should return 404 when there is no diagram`() {
        val processInstanceId = associateInstance()
        allowDocumentView()
        whenever(diagramService.getProcessInstanceDiagram(processInstanceId)).thenReturn(null)

        val response = resource.getProcessInstanceDiagram(caseId, processInstanceId)

        assertEquals(404, response.statusCode.value())
    }

    @Test
    fun `should be denied without document VIEW permission`() {
        val processInstanceId = associateInstance()
        denyDocumentView()

        assertThrows<AccessDeniedException> { resource.getProcessInstanceDiagram(caseId, processInstanceId) }
        verify(diagramService, never()).getProcessInstanceDiagram(any())
    }

    @Test
    fun `should return 404 when process instance does not belong to case`() {
        val processInstanceId = UUID.randomUUID().toString()
        allowDocumentView()
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(emptyList())

        val ex = assertThrows<ResponseStatusException> {
            resource.getProcessInstanceDiagram(caseId, processInstanceId)
        }
        assertEquals(404, ex.statusCode.value())
        verify(diagramService, never()).getProcessInstanceDiagram(any())
    }

    @Test
    fun `should return 404 when the case document does not exist`() {
        val processInstanceId = UUID.randomUUID().toString()
        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.empty())

        val ex = assertThrows<ResponseStatusException> {
            resource.getProcessInstanceDiagram(caseId, processInstanceId)
        }
        assertEquals(404, ex.statusCode.value())
        verify(authorizationService, never()).requirePermission(any<EntityAuthorizationRequest<JsonSchemaDocument>>())
        verify(diagramService, never()).getProcessInstanceDiagram(any())
    }

    private fun allowDocumentView() {
        val document = mock<JsonSchemaDocument>()
        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.of(document))
    }

    private fun denyDocumentView() {
        val document = mock<JsonSchemaDocument>()
        whenever(documentService.findBy(any<Document.Id>())).thenReturn(Optional.of(document))
        whenever(
            authorizationService.requirePermission(
                argThat<EntityAuthorizationRequest<JsonSchemaDocument>> { resourceType == JsonSchemaDocument::class.java }
            )
        ).doThrow(AccessDeniedException("denied"))
    }

    private fun associateInstance(): String {
        val processInstanceId = UUID.randomUUID().toString()
        val pInstanceId = mock<ProcessInstanceId>()
        whenever(pInstanceId.toString()).thenReturn(processInstanceId)
        val id = mock<ProcessDocumentInstanceId>()
        whenever(id.processInstanceId()).thenReturn(pInstanceId)
        val instance = ProcessDocumentInstanceDto(id, "p", true, 1, 1, null, null)
        whenever(processDocumentAssociationService.findProcessDocumentInstanceDtos(any<Document.Id>()))
            .thenReturn(listOf(instance))
        return processInstanceId
    }
}
