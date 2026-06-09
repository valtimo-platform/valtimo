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

import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.plugin.service.PluginService
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.Comparator
import com.ritense.zakenapi.domain.SearchParameter
import com.ritense.zakenapi.domain.ZaakResponse
import com.ritense.zakenapi.exception.MultipleZakenFoundException
import com.ritense.zakenapi.exception.ZaakNotFoundException
import com.ritense.zakenapi.security.Zaak
import com.ritense.zakenapi.security.ZaakActionProvider
import org.springframework.data.domain.Pageable
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

open class ZaakService(
    private val pluginService: PluginService,
    private val authorizationService: AuthorizationService,
) {

    @Transactional
    open fun getZaakByIdentificatie(zaakIdentificatie: String, zakenApiPluginId: UUID?): ZaakResponse {
        val zaakResponses = getZakenByIdentificatie(zaakIdentificatie, zakenApiPluginId)

        val authorizedZaken = zaakResponses.filter { zaakResponse ->
            authorizationService.hasPermission(
                EntityAuthorizationRequest(
                    Zaak::class.java,
                    ZaakActionProvider.VIEW_ACTIVE_STATUS,
                    Zaak(zaaktype = zaakResponse.zaaktype.toString())
                )
            )
        }

        if (authorizedZaken.isEmpty()) {
            throw ZaakNotFoundException("No authorized zaak found for identificatie '$zaakIdentificatie'")
        }
        if (authorizedZaken.size > 1) {
            throw MultipleZakenFoundException("More than one authorized zaak found for identificatie '$zaakIdentificatie'")
        }

        return authorizedZaken[0]
    }

    private fun getZakenByIdentificatie(zaakIdentificatie: String, zakenApiPluginId: UUID?): List<ZaakResponse> {
        val searchParameters = listOf(
            SearchParameter("identificatie", Comparator.EQUAL_TO, zaakIdentificatie)
        )

        return if (zakenApiPluginId != null) {
            val plugin: ZakenApiPlugin = pluginService.createInstance(zakenApiPluginId)
            plugin.searchZaken(searchParameters, Pageable.unpaged()).results
        } else {
            val pluginConfigurations = pluginService.findPluginConfigurations(ZakenApiPlugin::class.java)
            check(pluginConfigurations.isNotEmpty()) { "No ZakenApiPlugin configurations found" }

            pluginConfigurations.flatMap { config ->
                val plugin: ZakenApiPlugin = pluginService.createInstance(config.id.id)
                plugin.searchZaken(searchParameters, Pageable.unpaged()).results
            }
        }
    }
}
