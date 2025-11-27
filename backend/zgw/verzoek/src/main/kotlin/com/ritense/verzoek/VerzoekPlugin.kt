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
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.notificatiesapi.NotificatiesApiListener
import com.ritense.notificatiesapi.NotificatiesApiPlugin
import com.ritense.notificatiesapi.domain.Abonnement
import com.ritense.objectmanagement.service.ObjectManagementService
import com.ritense.objecttypenapi.ObjecttypenApiPlugin
import com.ritense.plugin.annotation.Plugin
import com.ritense.plugin.annotation.PluginEvent
import com.ritense.plugin.annotation.PluginProperty
import com.ritense.plugin.domain.EventType
import com.ritense.plugin.domain.PluginConfigurationId
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.service.ApplicationStateService
import com.ritense.verzoek.domain.CopyStrategy
import com.ritense.verzoek.domain.VerzoekProperties
import com.ritense.zgw.Rsin
import jakarta.validation.Valid
import jakarta.validation.ValidationException
import org.semver4j.Semver
import kotlin.jvm.optionals.getOrNull
import com.ritense.processdocument.resolver.CaseDocumentJsonValueResolverFactory.Companion.PREFIX as DOC_PREFIX
import com.ritense.valueresolver.ProcessVariableValueResolverFactory.Companion.PREFIX as PV_PREFIX

@Plugin(
    key = "verzoek",
    title = "Verzoek",
    description = "Handles verzoeken"
)
class VerzoekPlugin(
    private val caseDefinitionService: CaseDefinitionService,
    private val documentDefinitionService: JsonSchemaDocumentDefinitionService,
    private val objectManagementService: ObjectManagementService,
    private val pluginService: PluginService,
    private val applicationStateService: ApplicationStateService,
) : NotificatiesApiListener {

    @PluginProperty(key = "notificatiesApiPluginConfiguration", secret = false)
    lateinit var notificatiesApiPluginConfiguration: NotificatiesApiPlugin

    @PluginProperty(key = "processToStart", secret = false)
    lateinit var processToStart: String

    @PluginProperty(key = "rsin", secret = false)
    lateinit var rsin: Rsin

    @Valid
    @PluginProperty(key = "verzoekProperties", secret = false)
    lateinit var verzoekProperties: List<VerzoekProperties>

    @PluginEvent(invokedOn = [EventType.CREATE, EventType.UPDATE])
    fun validateProperties() {
        if (!applicationStateService.isApplicationReady()) {
            return // Skip validation: Case Definition might not exist yet because the auto deployment of Case Definitions happens later.
        }

        verzoekProperties
            .filter { it.copyStrategy == CopyStrategy.SPECIFIED }
            .forEach { property ->
                property.mapping?.forEach {
                    if (!it.target.startsWith(DOC_PREFIX) && !it.target.startsWith(PV_PREFIX)) {
                        throw ValidationException("Failed to set mapping. Unknown prefix '${it.target.substringBefore(":")}:'.")
                    }

                    if (it.target.startsWith(DOC_PREFIX)) {
                        val documentDefinition = runWithoutAuthorization {
                            val caseDefinition = getCaseDefinition(
                                caseDefinitionKey = property.caseDefinitionKey,
                                caseDefinitionVersionTag = property.caseDefinitionVersionTag,
                            )
                                ?: error("No case definition found for '${property.caseDefinitionKey}:${property.caseDefinitionVersionTag}'.")
                            documentDefinitionService.findBySolutionModuleId(caseDefinition.id).getOrNull()
                                ?: error("No Document Definition found for Case Definition: ${caseDefinition.id}")
                        }
                        val documentPath = it.target.substringAfter(delimiter = ":")
                        runWithoutAuthorization {
                            documentDefinitionService.validateJsonPointer(
                                documentDefinition.id.name(),
                                documentPath
                            )
                        }
                    }
                }
            }
    }

    override fun getNotificatiesApiPlugin(): NotificatiesApiPlugin {
        return notificatiesApiPluginConfiguration
    }

    override fun getKanaalFilters(): List<Abonnement.Kanaal> {
        return verzoekProperties.map { verzoekProperty ->
            val objectManagement = objectManagementService.getById(verzoekProperty.objectManagementId)
                ?: throw IllegalStateException("Object management not found for portaaltaak")

            val objecttypenApiPlugin = pluginService.createInstance(
                PluginConfigurationId
                    .existingId(objectManagement.objecttypenApiPluginConfigurationId)
            ) as ObjecttypenApiPlugin

            Abonnement.Kanaal(
                naam = "objecten",
                filters = mapOf(
                    "objectType" to "${objecttypenApiPlugin.url}objecttypes/${objectManagement.objecttypeId}",
                    "actie" to "create"
                )
            )
        }
    }

    private fun getCaseDefinition(caseDefinitionKey: String, caseDefinitionVersionTag: Semver?): CaseDefinition? {
        return if (caseDefinitionVersionTag == null) {
            caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey)
        } else {
            caseDefinitionService.getCaseDefinitions(
                caseDefinitionKey = caseDefinitionKey,
                caseDefinitionVersionTag = caseDefinitionVersionTag,
            ).singleOrNull()
        }
    }
}
