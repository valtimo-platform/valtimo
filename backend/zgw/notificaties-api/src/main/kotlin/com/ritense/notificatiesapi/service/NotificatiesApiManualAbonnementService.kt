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

package com.ritense.notificatiesapi.service

import com.ritense.notificatiesapi.NotificatiesApiKanaalFilters
import com.ritense.notificatiesapi.NotificatiesApiPlugin
import com.ritense.notificatiesapi.web.dto.NotificatiesApiManualAbonnementResponse
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Service
import java.util.UUID

@Service
@SkipComponentScan
class NotificatiesApiManualAbonnementService(
    private val pluginService: PluginService
) {

    fun getManualAbonnement(configurationId: UUID): NotificatiesApiManualAbonnementResponse? {
        val configuration = pluginService.findPluginConfiguration(PluginConfigurationId.existingId(configurationId))
            ?: return null
        val plugin = pluginService.createInstance(configuration) as? NotificatiesApiPlugin ?: return null
        if (!plugin.isManualAbonnementRegistration()) return null

        return NotificatiesApiManualAbonnementResponse(
            callbackUrl = plugin.callbackUrl.toASCIIString(),
            kanalen = NotificatiesApiKanaalFilters.fromPluginService(pluginService).manualKanaalFilters(configurationId)
        )
    }
}
