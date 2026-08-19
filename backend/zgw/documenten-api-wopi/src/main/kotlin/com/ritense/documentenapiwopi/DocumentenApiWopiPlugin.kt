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

package com.ritense.documentenapiwopi

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapiwopi.DocumentenApiWopiPlugin.Companion.PLUGIN_KEY
import com.ritense.documentenapiwopi.client.WopiClient
import com.ritense.documentenapiwopi.domain.WopiAccessToken
import com.ritense.documentenapiwopi.domain.WopiDiscovery
import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginProperty
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.validation.Url
import java.net.URI
import java.util.UUID

@Plugin(
    key = PLUGIN_KEY,
    title = "Documenten API WOPI",
    description = "Enables users to view, edit and collaborate on documents disclosed through the Documenten API"
)
class DocumentenApiWopiPlugin(
    private val wopiClient: WopiClient,
    private val pluginService: PluginService,
) {
    @Url
    @PluginProperty(key = WOPI_CLIENT_DISCOVERY_URL_PROPERTY, secret = false)
    lateinit var wopiClientDiscoveryUrl: URI

    @PluginProperty(key = DOCUMENTEN_API_CONFIGURATION_ID, secret = false)
    lateinit var documentenApiConfigurationId: String

    fun getWopiHostPageUrl(documentId: String, caseDocumentId: UUID?): URI {
        val documentenApiPlugin = getDocumentenApiPlugin()
        val documentInformatieObject = documentenApiPlugin.requireModifyAccess(documentId, caseDocumentId)
        val extension = documentInformatieObject.bestandsnaam?.substringAfterLast('.', "")?.lowercase()

        val documentenApiAuthentication = documentenApiPlugin.authenticationPluginConfiguration
        val slatToken: WopiAccessToken = wopiClient.getWopiAccessToken(documentenApiPlugin.url, documentId, documentenApiAuthentication)
        val wopiDiscovery: WopiDiscovery = wopiClient.getWopiDiscovery(wopiClientDiscoveryUrl)
        val wopiClientUrl: URI = wopiDiscovery.editActionUrl(extension)

        return wopiClient.buildWopiHostPageUrl(documentenApiPlugin.url, wopiClientUrl, documentId, slatToken)
    }

    private fun getDocumentenApiPlugin(): DocumentenApiPlugin {
        return checkNotNull(pluginService.createInstance(documentenApiConfigurationId)){
            "Could not create instance of ${DocumentenApiPlugin::class.simpleName} based on documenten API configuration ID: $documentenApiConfigurationId"
        }
    }

    companion object {
        const val PLUGIN_KEY = "documentenapiwopi"
        const val WOPI_CLIENT_DISCOVERY_URL_PROPERTY = "wopiClientDiscoveryUrl"
        const val DOCUMENTEN_API_CONFIGURATION_ID = "documentenApiConfigurationId"

        fun findConfigurationByDocumentenApiConfiguration(documentenApiConfigurationId: String) = { properties: JsonNode ->
            documentenApiConfigurationId == properties[DOCUMENTEN_API_CONFIGURATION_ID].textValue()
        }
    }
}

fun WopiDiscovery.editActionUrl(extension: String?): URI {
    val actionUrl = netZone.apps
        .flatMap { it.actions.orEmpty() }
        .firstOrNull { it.name == "edit" && it.ext.equals(extension, ignoreCase = true) }
        ?.urlSrc

    if (actionUrl.isNullOrBlank()) {
        throw IllegalStateException("No WOPI 'edit' action found in discovery for file extension '$extension'")
    }

    return URI(actionUrl)
}