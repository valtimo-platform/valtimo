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

package com.ritense.verzoek

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.service.CaseDefinitionService
import com.ritense.documentenapi.DocumentenApiPlugin
import com.ritense.notificatiesapi.NotificatiesApiListener
import com.ritense.notificatiesapi.NotificatiesApiPlugin
import com.ritense.notificatiesapi.domain.Abonnement
import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginEvent
import com.ritense.plugin.annotation.PluginProperty
import com.ritense.plugin.domain.EventType
import com.ritense.valtimo.service.ApplicationStateService
import com.ritense.verzoek.domain.InformatieobjecttypeUrl
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.repository.ZaakTypeLinkRepository

@Plugin(
    key = "document-verzoek",
    title = "Document Verzoek",
    description = "Handles document verzoeken"
)
class DocumentVerzoekPlugin(
    private val applicationStateService: ApplicationStateService,
    private val zaakTypeLinkRepository: ZaakTypeLinkRepository,
    private val caseDefinitionService: CaseDefinitionService,

    ) : NotificatiesApiListener {

    @PluginProperty(key = "notificatiesApiPluginConfiguration", secret = false)
    lateinit var notificatiesApiPluginConfiguration: NotificatiesApiPlugin

    @PluginProperty(key = "zakenApiPlugin", secret = false)
    lateinit var zakenApiPlugin: ZakenApiPlugin

    @PluginProperty(key = "documentenApiPlugin", secret = false)
    lateinit var documentenApiPlugin: DocumentenApiPlugin

    @PluginProperty(key = "eventMessage", secret = false)
    lateinit var eventMessage: String

    @PluginProperty(key = "informatieobjecttypeUrls", secret = false)
    lateinit var informatieobjecttypeUrls: List<InformatieobjecttypeUrl>

    @PluginEvent(invokedOn = [EventType.CREATE, EventType.UPDATE])
    fun validateProperties() {
        if (!applicationStateService.isApplicationReady()) {
            return // Skip validation: Case Definition might not exist yet because the auto deployment of Case Definitions happens later.
        }
    }

    override fun getNotificatiesApiPlugin(): NotificatiesApiPlugin {
        return notificatiesApiPluginConfiguration
    }

    override fun getKanaalFilters(): List<Abonnement.Kanaal> {
        return runWithoutAuthorization {
            (caseDefinitionService.getCaseDefinitions(active = true, final = false) +
                caseDefinitionService.getCaseDefinitions(active = true, final = true)).mapNotNull { caseDefinition ->

                val zaakTypeLink = zaakTypeLinkRepository.findByCaseDefinitionId(caseDefinition.id)
                    ?: return@mapNotNull null

                Abonnement.Kanaal(
                    naam = "zaken",
                    filters = mapOf(
                        "zaakType" to zaakTypeLink.zaakTypeUrl.toString(),
                        "actie" to "create",
                        "resource" to "zaakinformatieobject"
                    )
                )
            }
        }.distinct()
    }
}
