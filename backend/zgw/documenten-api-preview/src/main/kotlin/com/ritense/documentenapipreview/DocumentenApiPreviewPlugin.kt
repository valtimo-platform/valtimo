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

package com.ritense.documentenapipreview

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapipreview.DocumentenApiPreviewPlugin.Companion.PLUGIN_KEY
import com.ritense.documentenapipreview.client.PdfConversionClient
import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginProperty
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.validation.Url
import java.io.InputStream
import java.net.URI


@Plugin(
    key = PLUGIN_KEY,
    title = "Documenten API Preview",
    description = "Allows previewing documents disclosed through the Documenten API"
)
class DocumentenApiPreviewPlugin(
    private val pdfConversionClient: PdfConversionClient,
    private val pluginService: PluginService,
) {
    @Url
    @PluginProperty(key = URL_PROPERTY, secret = false)
    lateinit var url: URI

    @PluginProperty(key = DOCUMENTEN_API_CONFIGURATION_ID, secret = false)
    lateinit var documentenApiConfigurationId: String

    fun generatePreview(documentId: String): InputStream {
        val documentenApiPlugin = getDocumentenApiPlugin()
        val documentStream = documentenApiPlugin.downloadInformatieObject(documentId)

        return pdfConversionClient.convertDocument(url, documentStream)
    }

    private fun getDocumentenApiPlugin(): DocumentenApiPlugin {
        return checkNotNull(pluginService.createInstance(documentenApiConfigurationId)){
            "Could not create instance of ${DocumentenApiPlugin::class.simpleName} based on documenten API configuration ID: $documentenApiConfigurationId"
        }
    }

    companion object {
        const val PLUGIN_KEY = "documentenapipreview"
        const val URL_PROPERTY = "url"
        const val DOCUMENTEN_API_CONFIGURATION_ID = "documentenApiConfigurationId"

        fun findConfigurationByDocumentenApiConfiguration(documentenApiConfigurationId: String) = { properties: JsonNode ->
            documentenApiConfigurationId == properties[DOCUMENTEN_API_CONFIGURATION_ID].textValue()
        }
    }
}