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
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class DocumentenApiPreviewServiceTest {
    private lateinit var documentenApiPreviewService: DocumentenApiPreviewService
    private lateinit var pluginService: PluginService

    @BeforeEach
    fun before() {
        pluginService = mock<PluginService>()

        documentenApiPreviewService = DocumentenApiPreviewService(pluginService)
    }

    @Test
    fun `should call plugin to generate preview for document`() {
        val documentApiConfigurationId = "mock_document_api_configuration_id"
        val documentId = "mock_document_identifier"
        val pluginInstance = mock<DocumentenApiPreviewPlugin>()
        whenever(pluginService.createInstance<DocumentenApiPreviewPlugin>(any(), any()))
            .thenReturn(pluginInstance)

        documentenApiPreviewService.generatePreview(documentApiConfigurationId, documentId)

        verify(pluginInstance).generatePreview(documentId)
    }
}