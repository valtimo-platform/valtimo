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

package com.ritense.zakenapi.service

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.documentenapi.service.InformatieObjectCaseResolver
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.repository.ZaakInstanceLinkRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.web.client.RestClientException
import java.util.UUID

class ZaakInformatieObjectCaseResolver(
    private val pluginService: PluginService,
    private val zaakInstanceLinkRepository: ZaakInstanceLinkRepository,
) : InformatieObjectCaseResolver {

    override fun getLinkedCaseDocumentIds(pluginConfigurationId: String, documentId: String): List<UUID> {
        val documentenApiPlugin = pluginService.createInstance<DocumentenApiPlugin>(pluginConfigurationId)
        val informatieobjectUrl = documentenApiPlugin.createInformatieObjectUrl(documentId)

        // Lookup must not depend on the caller's ZgwDocument permissions; callers check case access themselves
        return runWithoutAuthorization {
            pluginService.findPluginConfigurations(ZakenApiPlugin::class.java)
                .flatMap { configuration ->
                    val zakenApiPlugin = pluginService.createInstance(configuration.id) as ZakenApiPlugin
                    try {
                        zakenApiPlugin.getZaakInformatieObjectenByInformatieobjectUrl(null, informatieobjectUrl)
                    } catch (e: RestClientException) {
                        logger.warn(e) {
                            "Could not look up zaakinformatieobjecten of '$informatieobjectUrl' " +
                                "in Zaken API plugin configuration '${configuration.id.id}'"
                        }
                        emptyList()
                    }
                }
                .mapNotNull { zaakInstanceLinkRepository.findByZaakInstanceUrl(it.zaak)?.documentId }
                .distinct()
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
