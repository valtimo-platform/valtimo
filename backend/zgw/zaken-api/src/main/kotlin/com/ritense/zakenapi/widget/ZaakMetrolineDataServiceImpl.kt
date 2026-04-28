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

package com.ritense.zakenapi.widget

import com.ritense.case_.widget.metroline.MetrolineItem
import com.ritense.case_.widget.metroline.ZaakMetrolineDataService
import com.ritense.catalogiapi.CatalogiApiPlugin
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZaakUrlProvider
import com.ritense.zakenapi.ZakenApiPlugin
import java.net.URI
import java.util.UUID

class ZaakMetrolineDataServiceImpl(
    private val zaakUrlProvider: ZaakUrlProvider,
    private val pluginService: PluginService,
) : ZaakMetrolineDataService {

    override fun getMetrolineItems(documentId: UUID): List<MetrolineItem> {
        val zaakUrl = zaakUrlProvider.getZaakUrl(documentId)
        val zakenApiPlugin = getZakenApiPlugin(zaakUrl)

        val zaak = zakenApiPlugin.getZaak(zaakUrl)
        val zaaktypeUrl = zaak.zaaktype

        val catalogiApiPlugin = getCatalogiApiPlugin(zaaktypeUrl)
        val statustypen = catalogiApiPlugin.getStatustypen(zaaktypeUrl).sortedBy { it.volgnummer }

        val zaakStatussen = zakenApiPlugin.getZaakStatussen(zaakUrl)
        val completedStatustypeUrls = zaakStatussen.map { it.statustype }.toSet()

        return statustypen.map { statustype ->
            MetrolineItem(
                title = statustype.omschrijving,
                label = statustype.toelichting,
                completed = completedStatustypeUrls.contains(statustype.url),
            )
        }
    }

    private fun getZakenApiPlugin(zaakUrl: URI): ZakenApiPlugin {
        return pluginService.createInstance(
            ZakenApiPlugin::class.java,
            ZakenApiPlugin.findConfigurationByUrl(zaakUrl)
        ) ?: throw IllegalStateException(
            "Missing plugin configuration of type '${ZakenApiPlugin.PLUGIN_KEY}' for url '$zaakUrl'"
        )
    }

    private fun getCatalogiApiPlugin(zaaktypeUrl: URI): CatalogiApiPlugin {
        return pluginService.createInstance(
            CatalogiApiPlugin::class.java,
            CatalogiApiPlugin.findConfigurationByUrl(zaaktypeUrl)
        ) ?: throw IllegalStateException(
            "Missing plugin configuration of type '${CatalogiApiPlugin.PLUGIN_KEY}' for url '$zaaktypeUrl'"
        )
    }
}
