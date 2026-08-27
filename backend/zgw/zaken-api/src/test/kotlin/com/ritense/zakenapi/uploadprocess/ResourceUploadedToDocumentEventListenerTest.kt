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
import com.ritense.documentenapi.authorization.ZgwDocument
import com.ritense.resource.domain.MetadataType
import com.ritense.resource.domain.TemporaryResourceUploadedEvent
import com.ritense.resource.service.TemporaryResourceStorageService
import com.ritense.temporaryresource.domain.StorageMetadataKeys
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.operaton.service.OperatonRuntimeService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.runtime.ProcessInstance
import java.util.UUID

class ResourceUploadedToDocumentEventListenerTest {

    lateinit var listener: ResourceUploadedToDocumentEventListener
    lateinit var resourceService: TemporaryResourceStorageService
    lateinit var uploadProcessService: UploadProcessService
    lateinit var authorizationService: AuthorizationService
    lateinit var catalogiService: CatalogiService
    lateinit var caseDocumentResolver: CaseDocumentResolver
    lateinit var runtimeService: OperatonRuntimeService

    @BeforeEach
    fun beforeEach() {
        resourceService = mock()
        uploadProcessService = mock()
        authorizationService = mock()
        catalogiService = mock()
        caseDocumentResolver = mock()
        runtimeService = mock()
        listener = ResourceUploadedToDocumentEventListener(
            resourceService,
            uploadProcessService,
            authorizationService,
            catalogiService,
            caseDocumentResolver,
            runtimeService,
        )
    }

    @Test
    fun `should start upload process for the document id from the resource metadata`() {
        val documentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        whenever(resourceService.getResourceMetadata(RESOURCE_ID))
            .doReturn(mapOf(MetadataType.DOCUMENT_ID.key to documentId.toString()))
        whenever(caseDocumentResolver.resolveCaseDocumentId(documentId)).doReturn(caseDocumentId)

        listener.handle(TemporaryResourceUploadedEvent(RESOURCE_ID))

        verify(uploadProcessService).startUploadResourceProcess(documentId.toString(), RESOURCE_ID)
        verify(runtimeService, never()).findProcessInstanceById(any())
    }

    @Test
    fun `should check the create permission against the resolved case document id`() {
        val documentId = UUID.randomUUID()
        val caseDocumentId = UUID.randomUUID()
        whenever(resourceService.getResourceMetadata(RESOURCE_ID))
            .doReturn(mapOf(MetadataType.DOCUMENT_ID.key to documentId.toString()))
        whenever(caseDocumentResolver.resolveCaseDocumentId(documentId)).doReturn(caseDocumentId)

        listener.handle(TemporaryResourceUploadedEvent(RESOURCE_ID))

        val captor = argumentCaptor<EntityAuthorizationRequest<ZgwDocument>>()
        verify(authorizationService).requirePermission(captor.capture())
        assertEquals(caseDocumentId, captor.firstValue.entities.single().caseDocumentId)
    }

    @Test
    fun `should fall back to the business key of the process instance`() {
        val documentId = UUID.randomUUID()
        val processInstance: ProcessInstance = mock()
        whenever(processInstance.businessKey).doReturn(documentId.toString())
        whenever(resourceService.getResourceMetadata(RESOURCE_ID))
            .doReturn(mapOf(StorageMetadataKeys.PROCESS_INSTANCE_ID.key to PROCESS_INSTANCE_ID))
        whenever(runtimeService.findProcessInstanceById(PROCESS_INSTANCE_ID)).doReturn(processInstance)
        whenever(caseDocumentResolver.resolveCaseDocumentId(documentId)).doReturn(documentId)

        listener.handle(TemporaryResourceUploadedEvent(RESOURCE_ID))

        verify(uploadProcessService).startUploadResourceProcess(documentId.toString(), RESOURCE_ID)
    }

    @Test
    fun `should prefer the document id over the process instance business key`() {
        val documentId = UUID.randomUUID()
        whenever(resourceService.getResourceMetadata(RESOURCE_ID)).doReturn(
            mapOf(
                MetadataType.DOCUMENT_ID.key to documentId.toString(),
                StorageMetadataKeys.PROCESS_INSTANCE_ID.key to PROCESS_INSTANCE_ID,
            )
        )
        whenever(caseDocumentResolver.resolveCaseDocumentId(documentId)).doReturn(documentId)

        listener.handle(TemporaryResourceUploadedEvent(RESOURCE_ID))

        verify(uploadProcessService).startUploadResourceProcess(documentId.toString(), RESOURCE_ID)
        verify(runtimeService, never()).findProcessInstanceById(any())
    }

    @Test
    fun `should fall back to the process instance when the document id is not a uuid`() {
        val documentId = UUID.randomUUID()
        val processInstance: ProcessInstance = mock()
        whenever(processInstance.businessKey).doReturn(documentId.toString())
        whenever(resourceService.getResourceMetadata(RESOURCE_ID)).doReturn(
            mapOf(
                MetadataType.DOCUMENT_ID.key to "not-a-uuid",
                StorageMetadataKeys.PROCESS_INSTANCE_ID.key to PROCESS_INSTANCE_ID,
            )
        )
        whenever(runtimeService.findProcessInstanceById(PROCESS_INSTANCE_ID)).doReturn(processInstance)
        whenever(caseDocumentResolver.resolveCaseDocumentId(documentId)).doReturn(documentId)

        listener.handle(TemporaryResourceUploadedEvent(RESOURCE_ID))

        verify(uploadProcessService).startUploadResourceProcess(documentId.toString(), RESOURCE_ID)
    }

    @Test
    fun `should not start an upload process when no document can be resolved`() {
        whenever(resourceService.getResourceMetadata(RESOURCE_ID))
            .doReturn(mapOf(MetadataType.FILE_NAME.key to "test.pdf"))

        listener.handle(TemporaryResourceUploadedEvent(RESOURCE_ID))

        verify(uploadProcessService, never()).startUploadResourceProcess(any(), any())
        verify(authorizationService, never()).requirePermission(any<EntityAuthorizationRequest<ZgwDocument>>())
    }

    @Test
    fun `should not start an upload process when the process instance no longer exists`() {
        whenever(resourceService.getResourceMetadata(RESOURCE_ID))
            .doReturn(mapOf(StorageMetadataKeys.PROCESS_INSTANCE_ID.key to PROCESS_INSTANCE_ID))
        whenever(runtimeService.findProcessInstanceById(eq(PROCESS_INSTANCE_ID))).doReturn(null)

        listener.handle(TemporaryResourceUploadedEvent(RESOURCE_ID))

        verify(uploadProcessService, never()).startUploadResourceProcess(any(), any())
    }

    @Test
    fun `should not start an upload process when the business key is not a document id`() {
        val processInstance: ProcessInstance = mock()
        whenever(processInstance.businessKey).doReturn("some-business-key")
        whenever(resourceService.getResourceMetadata(RESOURCE_ID))
            .doReturn(mapOf(StorageMetadataKeys.PROCESS_INSTANCE_ID.key to PROCESS_INSTANCE_ID))
        whenever(runtimeService.findProcessInstanceById(PROCESS_INSTANCE_ID)).doReturn(processInstance)

        listener.handle(TemporaryResourceUploadedEvent(RESOURCE_ID))

        verify(uploadProcessService, never()).startUploadResourceProcess(any(), any())
    }

    companion object {
        private const val RESOURCE_ID = "1234567890"
        private const val PROCESS_INSTANCE_ID = "0987654321"
    }
}
