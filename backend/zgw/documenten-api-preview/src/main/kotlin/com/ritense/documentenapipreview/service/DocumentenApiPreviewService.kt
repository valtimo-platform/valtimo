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

import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapi.DocumentenApiPlugin.Companion.findConfigurationByUrl
import com.ritense.documentenapipreview.DocumentenApiPreviewPlugin
import com.ritense.documentenapipreview.domain.PdfFile
import com.ritense.logging.LoggableResource
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.zgw.LoggingConstants.DOCUMENTEN_API
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.io.InputStream

@Transactional(readOnly = true)
@Service
@SkipComponentScan
class DocumentenApiPreviewService(
    private val pluginService: PluginService,
) {
    open fun generatePreview(
        @LoggableResource(resourceType = PluginConfigurationId::class) documentenApiConfigurationId: String,
        @LoggableResource(resourceTypeName = DOCUMENTEN_API.ENKELVOUDIG_INFORMATIE_OBJECT) documentId: String
    ): PdfFile {
        val documentPreviewApiPlugin = getDocumentenApiPreviewPlugin(documentenApiConfigurationId)

        return documentPreviewApiPlugin.generatePreview(documentId)
    }

    private fun getDocumentenApiPreviewPlugin(documentenApiConfigurationId: String): DocumentenApiPreviewPlugin {
        return checkNotNull(
            pluginService.createInstance(
                DocumentenApiPreviewPlugin::class.java,
                DocumentenApiPreviewPlugin.findConfigurationByDocumentenApiConfiguration(documentenApiConfigurationId)
            )
        ) { "Could not create instance of ${DocumentenApiPreviewPlugin::class.simpleName} based on documenten API configuration ID: $documentenApiConfigurationId" }
    }
}