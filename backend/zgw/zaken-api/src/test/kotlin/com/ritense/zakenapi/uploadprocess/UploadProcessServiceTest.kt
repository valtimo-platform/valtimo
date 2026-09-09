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

package com.ritense.zakenapi.uploadprocess

import com.ritense.document.domain.Document
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.domain.CaseDefinitionProcessLink
import com.ritense.processdocument.domain.CaseDefinitionProcessLinkId
import com.ritense.processdocument.domain.impl.request.StartProcessForDocumentRequest
import com.ritense.processdocument.service.CaseDefinitionProcessLinkService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processdocument.service.result.StartProcessForDocumentResult
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.zakenapi.uploadprocess.UploadProcessService.Companion.DOCUMENT_UPLOAD
import com.ritense.zakenapi.uploadprocess.UploadProcessService.Companion.RESOURCE_ID_PROCESS_VAR
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional
import java.util.UUID

class UploadProcessServiceTest {

    lateinit var documentService: DocumentService
    lateinit var processDocumentService: ProcessDocumentService
    lateinit var caseDefinitionProcessLinkService: CaseDefinitionProcessLinkService
    lateinit var caseDocumentResolver: CaseDocumentResolver
    lateinit var uploadProcessService: UploadProcessService

    @BeforeEach
    fun setup() {
        documentService = mock()
        processDocumentService = mock()
        caseDefinitionProcessLinkService = mock()
        caseDocumentResolver = mock()
        uploadProcessService = UploadProcessService(
            documentService,
            processDocumentService,
            caseDefinitionProcessLinkService,
            caseDocumentResolver,
        )
    }

    @Test
    fun `should start upload process for the case document`() {
        val caseDocumentId = UUID.randomUUID()
        mockCaseDocument(caseDocumentId, caseDocumentId)
        mockUploadProcessLink()
        mockSuccessfulProcessStart()

        uploadProcessService.startUploadResourceProcess(caseDocumentId.toString(), RESOURCE_ID)

        assertThat(capturedRequest().documentId).isEqualTo(JsonSchemaDocumentId.existingId(caseDocumentId))
    }

    @Test
    fun `should start upload process for the case document of a building block document`() {
        val buildingBlockDocumentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        mockCaseDocument(buildingBlockDocumentId, caseDocumentId)
        mockUploadProcessLink()
        mockSuccessfulProcessStart()

        uploadProcessService.startUploadResourceProcess(buildingBlockDocumentId.toString(), RESOURCE_ID)

        val request = capturedRequest()
        assertThat(request.documentId).isEqualTo(JsonSchemaDocumentId.existingId(caseDocumentId))
        assertThat(request.processDefinitionKey).isEqualTo(PROCESS_DEFINITION_KEY)
        assertThat(request.processVars).containsEntry(RESOURCE_ID_PROCESS_VAR, RESOURCE_ID)
    }

    @Test
    fun `should throw when the case has no upload process linked`() {
        val buildingBlockDocumentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        mockCaseDocument(buildingBlockDocumentId, caseDocumentId)
        whenever(caseDefinitionProcessLinkService.getDocumentDefinitionProcessLink(CASE_DEFINITION_ID, DOCUMENT_UPLOAD))
            .thenReturn(null)

        val exception = assertThrows<IllegalStateException> {
            uploadProcessService.startUploadResourceProcess(buildingBlockDocumentId.toString(), RESOURCE_ID)
        }

        assertThat(exception).hasMessageContaining("No upload-process linked to case")
    }

    private fun mockCaseDocument(documentId: UUID, caseDocumentId: UUID) {
        whenever(caseDocumentResolver.resolveCaseDocumentId(documentId)).thenReturn(caseDocumentId)
        val caseDocument: Document = mock()
        whenever(caseDocument.definitionId())
            .thenReturn(JsonSchemaDocumentDefinitionId.forCase("bezwaar", CASE_DEFINITION_ID))
        whenever(documentService.get(caseDocumentId.toString())).thenReturn(caseDocument)
    }

    private fun mockUploadProcessLink() {
        whenever(caseDefinitionProcessLinkService.getDocumentDefinitionProcessLink(CASE_DEFINITION_ID, DOCUMENT_UPLOAD))
            .thenReturn(
                CaseDefinitionProcessLink(
                    CaseDefinitionProcessLinkId.newId(CASE_DEFINITION_ID, PROCESS_DEFINITION_KEY),
                    DOCUMENT_UPLOAD
                )
            )
    }

    private fun mockSuccessfulProcessStart() {
        val result: StartProcessForDocumentResult = mock()
        whenever(result.resultingDocument()).thenReturn(Optional.of(mock<Document>()))
        whenever(processDocumentService.startProcessForDocument(any())).thenReturn(result)
    }

    private fun capturedRequest(): StartProcessForDocumentRequest {
        val captor = argumentCaptor<StartProcessForDocumentRequest>()
        verify(processDocumentService).startProcessForDocument(captor.capture())
        return captor.firstValue
    }

    private companion object {
        val CASE_DEFINITION_ID = CaseDefinitionId("bezwaar", "1.0.1")
        const val PROCESS_DEFINITION_KEY = "document-upload"
        const val RESOURCE_ID = "resource-id"
    }
}
