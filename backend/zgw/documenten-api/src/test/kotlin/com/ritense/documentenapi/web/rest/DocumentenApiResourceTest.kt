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

package com.ritense.documentenapi.web.rest

import com.ritense.documentenapi.service.DocumentenApiService
import com.ritense.documentenapi.service.DocumentenApiVersionService
import com.ritense.documentenapi.web.rest.dto.ModifyDocumentRequest
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import java.time.LocalDate
import java.util.UUID

class DocumentenApiResourceTest {
    private lateinit var documentenApiService: DocumentenApiService
    private lateinit var resource: DocumentenApiResource

    @BeforeEach
    fun before() {
        documentenApiService = mock()
        resource = DocumentenApiResource(documentenApiService, mock<DocumentenApiVersionService>())
    }

    @Test
    fun `deleteDocument should delete with the resolved case document id`() {
        val caseDocumentId = UUID.randomUUID()
        whenever(documentenApiService.requireViewableLinkedCaseDocumentId(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID))
            .thenReturn(caseDocumentId)

        resource.deleteDocument(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID)

        verify(documentenApiService).deleteInformatieObject(PLUGIN_CONFIGURATION_ID, caseDocumentId, DOCUMENT_ID)
    }

    @Test
    fun `modifyDocument should modify with the resolved case document id`() {
        val caseDocumentId = UUID.randomUUID()
        val request = ModifyDocumentRequest(LocalDate.now(), "titel", "auteur", taal = "nld")
        whenever(documentenApiService.requireViewableLinkedCaseDocumentId(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID))
            .thenReturn(caseDocumentId)

        resource.modifyDocument(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID, request)

        verify(documentenApiService).modifyInformatieObject(PLUGIN_CONFIGURATION_ID, caseDocumentId, DOCUMENT_ID, request)
    }

    @Test
    fun `deleteDocument should not delete when no viewable case is linked`() {
        whenever(documentenApiService.requireViewableLinkedCaseDocumentId(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID))
            .thenThrow(AccessDeniedException("denied"))

        assertThrows<AccessDeniedException> { resource.deleteDocument(PLUGIN_CONFIGURATION_ID, DOCUMENT_ID) }

        verify(documentenApiService, never()).deleteInformatieObject(
            PLUGIN_CONFIGURATION_ID,
            null as UUID?,
            DOCUMENT_ID
        )
    }

    companion object {
        private const val PLUGIN_CONFIGURATION_ID = "c850401b-9331-4cb6-8f1c-3e34b12e3d55"
        private const val DOCUMENT_ID = "3bd88200-11cb-45cf-a742-da01261755b1"
    }
}
