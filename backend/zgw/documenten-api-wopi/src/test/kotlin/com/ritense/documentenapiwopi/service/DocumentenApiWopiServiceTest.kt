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

package com.ritense.documentenapiwopi.service

import com.ritense.documentenapiwopi.DocumentenApiWopiPlugin
import com.ritense.plugin.service.PluginService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.UUID

class DocumentenApiWopiServiceTest {
    private lateinit var documentenApiWopiService: DocumentenApiWopiService
    private lateinit var pluginService: PluginService

    @BeforeEach
    fun before() {
        pluginService = mock<PluginService>()

        documentenApiWopiService = DocumentenApiWopiService(pluginService)
    }

    @Test
    fun `should call plugin to get wopi host page`() {
        val documentApiConfigurationId = "mock_document_api_configuration_id"
        val documentId = "mock_document_identifier"
        val caseDocumentId = UUID.randomUUID()
        val pluginInstance = mock<DocumentenApiWopiPlugin>()
        whenever(pluginService.createInstance<DocumentenApiWopiPlugin>(any(), any()))
            .thenReturn(pluginInstance)

        documentenApiWopiService.getWopiHostPageUrl(documentApiConfigurationId, documentId, caseDocumentId)

        verify(pluginInstance).getWopiHostPageUrl(documentId, caseDocumentId)
    }
}