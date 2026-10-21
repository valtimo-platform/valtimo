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

package com.ritense.notificatiesapi

import com.ritense.notificatiesapi.domain.Abonnement
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginConfigurationSearchParameters
import com.ritense.plugin.service.PluginService
import java.net.URI
import java.util.UUID

/** Attributes each kanaal filter to its Notificaties API configuration, keeping a manual one's filters out of automatic abonnementen. */
class NotificatiesApiKanaalFilters(
    private val listeners: List<NotificatiesApiListener>
) {
    private val manualConfigurations = listeners
        .map { it.getNotificatiesApiPlugin() }
        .filter { it.isManualAbonnementRegistration() }
        .distinctBy { it.notificatiesApiConfigurationId.id }

    private val manualConfigurationIds: Set<UUID> =
        manualConfigurations.map { it.notificatiesApiConfigurationId.id }.toSet()

    fun automaticListeners(): List<NotificatiesApiListener> =
        listeners.filter { !isManual(it.getNotificatiesApiPlugin()) }

    fun hasManualConfiguration(url: URI): Boolean =
        manualConfigurations.any { it.url.toString().trimEnd('/') == url.toString().trimEnd('/') }

    fun automaticKanaalFilters(listener: NotificatiesApiListener): List<Abonnement.Kanaal> =
        kanaalFilters(listener) { it?.id !in manualConfigurationIds }

    fun manualKanaalFilters(configurationId: UUID): List<Abonnement.Kanaal> =
        listeners
            .filter { it.getNotificatiesApiPlugin().notificatiesApiConfigurationId.id == configurationId }
            .flatMap { listener -> kanaalFilters(listener) { it?.id == configurationId } }
            .distinct()

    private fun kanaalFilters(
        listener: NotificatiesApiListener,
        linkedTo: (PluginConfigurationId?) -> Boolean
    ): List<Abonnement.Kanaal> =
        if (listener is NotificatiesApiPlugin) {
            listener.getReceiveNotificatieKanaalFilters(linkedTo)
        } else {
            listener.getKanaalFilters()
        }

    private fun isManual(plugin: NotificatiesApiPlugin) =
        plugin.notificatiesApiConfigurationId.id in manualConfigurationIds

    companion object {
        fun fromPluginService(pluginService: PluginService) = NotificatiesApiKanaalFilters(
            pluginService
                .getPluginConfigurations(PluginConfigurationSearchParameters(category = "notificaties-api-plugin"))
                .map { pluginService.createInstance(it) as NotificatiesApiListener }
        )
    }
}
