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

package com.ritense.processdocument.resolver

import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.impl.OperatonProcessInstanceId
import com.ritense.processdocument.service.ProcessDocumentService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.delegate.DelegateTask
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID

internal class DocumentTableValueResolverTest {

    private lateinit var processDocumentService: ProcessDocumentService
    private lateinit var documentService: DocumentService
    private lateinit var resolver: DocumentTableValueResolver

    private lateinit var processInstanceId: String
    private lateinit var variableScope: DelegateTask
    private lateinit var document: Document

    @BeforeEach
    fun setUp() {
        processDocumentService = mock()
        documentService = mock()
        resolver = DocumentTableValueResolver(processDocumentService, documentService)

        processInstanceId = UUID.randomUUID().toString()
        variableScope = mock()
        document = mock()
    }

    @Test
    fun `should have case prefix`() {
        assertThat(resolver.supportedPrefix()).isEqualTo("case")
    }

    @Test
    fun `should resolve assigneeFullName from case document`() {
        whenever(processDocumentService.getCaseDocument(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(document)
        whenever(document.assigneeFullName()).thenReturn("John Doe")

        val result = resolver.createResolver(processInstanceId, variableScope).apply("assigneeFullName")

        assertThat(result).isEqualTo("John Doe")
    }

    @Test
    fun `should resolve createdOn from case document`() {
        val createdOn = LocalDateTime.now()
        whenever(processDocumentService.getCaseDocument(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(document)
        whenever(document.createdOn()).thenReturn(createdOn)

        val result = resolver.createResolver(processInstanceId, variableScope).apply("createdOn")

        assertThat(result).isEqualTo(createdOn)
    }

    @Test
    fun `should resolve id from case document`() {
        val id = UUID.randomUUID()
        whenever(processDocumentService.getCaseDocument(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(document)
        whenever(document.id()).thenReturn(JsonSchemaDocumentId.existingId(id))

        val result = resolver.createResolver(processInstanceId, variableScope).apply("id")

        assertThat(result).isEqualTo(id)
    }

    @Test
    fun `should resolve modifiedOn returning null when not present`() {
        whenever(processDocumentService.getCaseDocument(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(document)
        whenever(document.modifiedOn()).thenReturn(Optional.empty())

        val result = resolver.createResolver(processInstanceId, variableScope).apply("modifiedOn")

        assertThat(result).isNull()
    }

    @Test
    fun `should throw on unknown column name`() {
        whenever(processDocumentService.getCaseDocument(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(document)

        val resolverFn = resolver.createResolver(processInstanceId, variableScope)

        assertThrows<IllegalArgumentException> {
            resolverFn.apply("unknownColumn")
        }
    }

    @Test
    fun `should handle assigneeId value in regular case process`() {
        val caseDocumentId = JsonSchemaDocumentId.existingId(UUID.randomUUID())
        whenever(processDocumentService.getDocumentId(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(caseDocumentId)
        whenever(processDocumentService.getCaseDocumentId(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(caseDocumentId)

        resolver.handleValues(processInstanceId, variableScope, mapOf("assigneeId" to "user123"))

        verify(documentService).assignUserToDocument(caseDocumentId.id, "user123")
    }

    @Test
    fun `should handle null assigneeId to unassign user`() {
        val caseDocumentId = JsonSchemaDocumentId.existingId(UUID.randomUUID())
        whenever(processDocumentService.getDocumentId(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(caseDocumentId)
        whenever(processDocumentService.getCaseDocumentId(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(caseDocumentId)

        resolver.handleValues(processInstanceId, variableScope, mapOf("assigneeId" to null))

        verify(documentService).unassignUserFromDocument(caseDocumentId.id)
    }

    @Test
    fun `should throw when trying to write values from building block context`() {
        val buildingBlockDocumentId = JsonSchemaDocumentId.existingId(UUID.randomUUID())
        val caseDocumentId = JsonSchemaDocumentId.existingId(UUID.randomUUID())

        whenever(processDocumentService.getDocumentId(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(buildingBlockDocumentId)
        whenever(processDocumentService.getCaseDocumentId(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(caseDocumentId)

        val exception = assertThrows<UnsupportedOperationException> {
            resolver.handleValues(processInstanceId, variableScope, mapOf("assigneeId" to "user123"))
        }

        assertThat(exception.message).isEqualTo("Writing case: values from within a building block is not supported")
    }

    @Test
    fun `should throw on unsupported write column`() {
        val caseDocumentId = JsonSchemaDocumentId.existingId(UUID.randomUUID())
        whenever(processDocumentService.getDocumentId(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(caseDocumentId)
        whenever(processDocumentService.getCaseDocumentId(OperatonProcessInstanceId(processInstanceId), variableScope))
            .thenReturn(caseDocumentId)

        assertThrows<IllegalArgumentException> {
            resolver.handleValues(processInstanceId, variableScope, mapOf("createdOn" to LocalDateTime.now()))
        }
    }
}
