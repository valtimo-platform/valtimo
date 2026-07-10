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
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.documentenapipreview.service

import com.ritense.documentenapipreview.DocumentenApiPreviewPlugin
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.service.ZaakDocumentService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

class DocumentenApiPreviewServiceTest {
    private lateinit var documentenApiPreviewService: DocumentenApiPreviewService
    private lateinit var pluginService: PluginService
    private lateinit var zaakDocumentService: ZaakDocumentService

    @BeforeEach
    fun before() {
        pluginService = mock<PluginService>()
        zaakDocumentService = mock<ZaakDocumentService>()

        documentenApiPreviewService = DocumentenApiPreviewService(pluginService, zaakDocumentService)
    }

    @Test
    fun `should verify case-document linkage before generating preview`() {
        val documentApiConfigurationId = "mock_document_api_configuration_id"
        val caseDocumentId = UUID.randomUUID()
        val documentId = "mock_document_identifier"
        val pluginInstance = mock<DocumentenApiPreviewPlugin>()
        whenever(pluginService.createInstance<DocumentenApiPreviewPlugin>(any(), any()))
            .thenReturn(pluginInstance)

        documentenApiPreviewService.generatePreview(documentApiConfigurationId, caseDocumentId, documentId)

        verify(zaakDocumentService).verifyInformatieObjectRelatedToCase(documentApiConfigurationId, caseDocumentId, documentId)
        verify(pluginInstance).generatePreview(caseDocumentId, documentId)
    }

    @Test
    fun `should not generate preview when document is not related to the case`() {
        val documentApiConfigurationId = "mock_document_api_configuration_id"
        val caseDocumentId = UUID.randomUUID()
        val documentId = "mock_document_identifier"
        val pluginInstance = mock<DocumentenApiPreviewPlugin>()
        whenever(pluginService.createInstance<DocumentenApiPreviewPlugin>(any(), any()))
            .thenReturn(pluginInstance)
        whenever(
            zaakDocumentService.verifyInformatieObjectRelatedToCase(
                eq(documentApiConfigurationId),
                eq(caseDocumentId),
                eq(documentId)
            )
        ).thenThrow(IllegalArgumentException("InformatieObject is not related to this Zaak"))

        val exception = assertThrows<IllegalArgumentException> {
            documentenApiPreviewService.generatePreview(documentApiConfigurationId, caseDocumentId, documentId)
        }

        assertEquals("InformatieObject is not related to this Zaak", exception.message)
        verify(pluginInstance, never()).generatePreview(any(), any())
    }
}
