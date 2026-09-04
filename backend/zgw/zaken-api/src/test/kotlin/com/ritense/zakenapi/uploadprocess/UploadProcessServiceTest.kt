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

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.catalogiapi.service.CatalogiService
import com.ritense.document.domain.Document
import com.ritense.document.domain.DocumentDefinition
import com.ritense.document.service.DocumentService
import com.ritense.documentenapi.authorization.ZgwDocument
import com.ritense.documentenapi.domain.DocumentenApiUploadFieldKey
import com.ritense.processdocument.domain.CaseDefinitionProcessLink
import com.ritense.processdocument.domain.CaseDefinitionProcessLinkId
import com.ritense.processdocument.domain.impl.request.StartProcessForDocumentRequest
import com.ritense.processdocument.service.CaseDefinitionProcessLinkService
import com.ritense.processdocument.service.ProcessDocumentService
import com.ritense.processdocument.service.result.StartProcessForDocumentResult
import com.ritense.resource.service.TemporaryResourceStorageService
import com.ritense.temporaryresource.domain.StorageMetadataKeys
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.zakenapi.uploadprocess.UploadProcessService.Companion.DOCUMENT_UPLOAD
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import java.util.Optional
import java.util.UUID

class UploadProcessServiceTest {

    private lateinit var documentService: DocumentService
    private lateinit var processDocumentService: ProcessDocumentService
    private lateinit var caseDefinitionProcessLinkService: CaseDefinitionProcessLinkService
    private lateinit var caseDocumentResolver: CaseDocumentResolver
    private lateinit var resourceService: TemporaryResourceStorageService
    private lateinit var authorizationService: AuthorizationService
    private lateinit var catalogiService: CatalogiService
    private lateinit var uploadProcessService: UploadProcessService

    @BeforeEach
    fun beforeEach() {
        documentService = mock()
        processDocumentService = mock()
        caseDefinitionProcessLinkService = mock()
        caseDocumentResolver = mock()
        resourceService = mock()
        authorizationService = mock()
        catalogiService = mock()
        uploadProcessService = UploadProcessService(
            documentService,
            processDocumentService,
            caseDefinitionProcessLinkService,
            caseDocumentResolver,
            resourceService,
            authorizationService,
            catalogiService,
        )
    }

    @Test
    fun `should start the upload process that is linked to the case`() {
        givenCaseWithUploadProcess()

        uploadProcessService.startUploadResourceProcess(DOCUMENT_ID, RESOURCE_ID)

        val captor = argumentCaptor<StartProcessForDocumentRequest>()
        verify(processDocumentService).startProcessForDocument(captor.capture())
        assertThat(captor.firstValue.documentId.id).isEqualTo(DOCUMENT_ID)
        assertThat(captor.firstValue.processDefinitionKey).isEqualTo(UPLOAD_PROCESS_KEY)
    }

    @Test
    fun `should check the create permission against the resolved case document`() {
        givenCaseWithUploadProcess()
        whenever(resourceService.getResourceMetadata(RESOURCE_ID)).doReturn(
            mapOf(DocumentenApiUploadFieldKey.STATUS.property to "definitief")
        )

        uploadProcessService.startUploadResourceProcess(DOCUMENT_ID, RESOURCE_ID)

        val captor = argumentCaptor<EntityAuthorizationRequest<ZgwDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        val zgwDocument = captor.firstValue.entities.single()
        assertThat(zgwDocument.caseDocumentId).isEqualTo(CASE_DOCUMENT_ID)
        assertThat(zgwDocument.status).isEqualTo("definitief")
    }

    @Test
    fun `should not start the upload process when the user may not create a document`() {
        whenever(caseDocumentResolver.resolveCaseDocumentId(DOCUMENT_ID)).doReturn(CASE_DOCUMENT_ID)
        doThrow(AccessDeniedException("Unauthorized"))
            .whenever(authorizationService).requirePermission(any<EntityAuthorizationRequest<ZgwDocument>>())

        assertThatThrownBy { uploadProcessService.startUploadResourceProcess(DOCUMENT_ID, RESOURCE_ID) }
            .isInstanceOf(AccessDeniedException::class.java)

        verify(processDocumentService, never()).startProcessForDocument(any())
    }

    @Test
    fun `should skip a resource that was already added to a case, without reading the resource`() {
        whenever(resourceService.getMetadataValueOrNull(RESOURCE_ID, StorageMetadataKeys.DOCUMENT_URL))
            .doReturn("http://localhost/documenten/api/v1/enkelvoudiginformatieobjecten/1")
        // An added resource may have been cleaned up already
        whenever(resourceService.getResourceMetadata(RESOURCE_ID))
            .doThrow(IllegalArgumentException("No resource found with id '$RESOURCE_ID'"))

        uploadProcessService.startUploadResourceProcess(DOCUMENT_ID, RESOURCE_ID)

        verify(processDocumentService, never()).startProcessForDocument(any())
        verify(authorizationService, never()).requirePermission(any<EntityAuthorizationRequest<ZgwDocument>>())
    }

    @Test
    fun `should fail when the case has no upload process linked to it`() {
        givenCaseWithUploadProcess(uploadProcessLinked = false)

        assertThatThrownBy { uploadProcessService.startUploadResourceProcess(DOCUMENT_ID, RESOURCE_ID) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("No upload-process linked to case")
    }

    private fun givenCaseWithUploadProcess(uploadProcessLinked: Boolean = true) {
        whenever(caseDocumentResolver.resolveCaseDocumentId(DOCUMENT_ID)).doReturn(CASE_DOCUMENT_ID)

        val definitionId: DocumentDefinition.Id = mock()
        whenever(definitionId.caseDefinitionId()).doReturn(CASE_DEFINITION_ID)
        val document: Document = mock()
        whenever(document.definitionId()).doReturn(definitionId)
        whenever(documentService.get(CASE_DOCUMENT_ID.toString())).doReturn(document)

        if (!uploadProcessLinked) {
            return
        }

        val link: CaseDefinitionProcessLink = mock()
        val linkId: CaseDefinitionProcessLinkId = mock()
        whenever(linkId.processDefinitionKey).doReturn(UPLOAD_PROCESS_KEY)
        whenever(link.id).doReturn(linkId)
        whenever(caseDefinitionProcessLinkService.getDocumentDefinitionProcessLink(CASE_DEFINITION_ID, DOCUMENT_UPLOAD))
            .doReturn(link)

        val result: StartProcessForDocumentResult = mock()
        whenever(result.resultingDocument()).doReturn(Optional.of(mock<Document>()))
        whenever(processDocumentService.startProcessForDocument(any())).doReturn(result)
    }

    companion object {
        private const val RESOURCE_ID = "1234567890"
        private const val UPLOAD_PROCESS_KEY = "document-upload"
        private val DOCUMENT_ID: UUID = UUID.randomUUID()
        private val CASE_DOCUMENT_ID: UUID = UUID.randomUUID()
        private val CASE_DEFINITION_ID = CaseDefinitionId("profile", "1.0.0")
    }
}
