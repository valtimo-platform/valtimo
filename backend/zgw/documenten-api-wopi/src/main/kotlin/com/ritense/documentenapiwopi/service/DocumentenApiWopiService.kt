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
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.net.URI
import java.util.UUID

@Transactional(readOnly = true)
@Service
@SkipComponentScan
class DocumentenApiWopiService(
    private val pluginService: PluginService,
) {
    fun getWopiHostPageUrl(documentenApiConfigurationId: String, documentId: String, caseDocumentId: UUID?): URI {
        val wopiPlugin = getDocumentenApiWopiPlugin(documentenApiConfigurationId)
        return wopiPlugin.getWopiHostPageUrl(documentId, caseDocumentId)
    }

    open fun isWopiConfigured(documentenApiConfigurationId: String): Boolean {
        return pluginService.findPluginConfigurations(
            DocumentenApiWopiPlugin::class.java,
            DocumentenApiWopiPlugin.findConfigurationByDocumentenApiConfiguration(documentenApiConfigurationId)
        ).isNotEmpty()
    }

    private fun getDocumentenApiWopiPlugin(documentenApiConfigurationId: String): DocumentenApiWopiPlugin {
        return checkNotNull(
            pluginService.createInstance(
                DocumentenApiWopiPlugin::class.java,
                DocumentenApiWopiPlugin.findConfigurationByDocumentenApiConfiguration(documentenApiConfigurationId)
            )
        ) { "Could not create instance of ${DocumentenApiWopiPlugin::class.simpleName} based on documenten API configuration ID: $documentenApiConfigurationId" }
    }
}