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
package com.ritense.zakenapi.listener

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.event.DocumentAssigneeChangedEvent
import com.ritense.document.event.DocumentUnassignedEvent
import com.ritense.document.service.DocumentService
import com.ritense.plugin.service.PluginService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.zakenapi.ZakenApiPlugin
import com.ritense.zakenapi.domain.ZaakInstanceLink
import com.ritense.zakenapi.link.ZaakInstanceLinkNotFoundException
import com.ritense.zakenapi.link.ZaakInstanceLinkService
import com.ritense.zakenapi.sync.CaseZakenApiSyncManagementService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import java.util.UUID

@SkipComponentScan
class ZakenApiCaseAssigneeListener(
    private val zaakInstanceLinkService: ZaakInstanceLinkService,
    private val pluginService: PluginService,
    private val caseZakenApiSyncManagementService: CaseZakenApiSyncManagementService,
    private val documentService: DocumentService,
    private val caseDocumentResolver: CaseDocumentResolver,
) {

    @EventListener(DocumentAssigneeChangedEvent::class)
    fun handleAssigneeChanged(event: DocumentAssigneeChangedEvent) {
        synchroniseAssigneeRol(event.documentId, event.assigneeId)
    }

    @EventListener(DocumentUnassignedEvent::class)
    fun handleUnassigned(event: DocumentUnassignedEvent) {
        synchroniseAssigneeRol(event.documentId, null)
    }

    private fun synchroniseAssigneeRol(documentId: UUID, newAssigneeUsername: String?) {
        val caseDefinitionId = resolveCaseDefinitionId(documentId)

        val syncConfig = caseZakenApiSyncManagementService.getSyncConfiguration(caseDefinitionId)
        if (syncConfig?.assigneeSyncEnabled != true) {
            return
        }
        val roltypeUrl = syncConfig.roltypeUrl ?: run {
            logger.warn { "Assignee sync enabled without a roltype URL for case definition '$caseDefinitionId'. Skipping." }
            return
        }

        val link = resolveLink(documentId) ?: return

        val zakenApiPlugin = pluginService.createInstance(
            ZakenApiPlugin::class.java,
            ZakenApiPlugin.findConfigurationByUrl(link.zaakInstanceUrl)
        ) ?: run {
            logger.debug { "No ZakenApi plugin configured for zaak '${link.zaakInstanceUrl}'. Skipping behandelaar sync." }
            return
        }

        runWithoutAuthorization {
            if (newAssigneeUsername != null) {
                zakenApiPlugin.upsertGzacBehandelaarRol(
                    zaakUrl = link.zaakInstanceUrl,
                    roltypeUrl = roltypeUrl,
                    username = newAssigneeUsername,
                )
            } else {
                zakenApiPlugin.removeGzacBehandelaarRollen(link.zaakInstanceUrl)
            }
        }
    }

    private fun resolveCaseDefinitionId(documentId: UUID): CaseDefinitionId =
        runWithoutAuthorization {
            val caseDocumentId = caseDocumentResolver.resolveCaseDocumentId(documentId)
            documentService[caseDocumentId.toString()].definitionId().caseDefinitionId()
        }

    private fun resolveLink(documentId: UUID): ZaakInstanceLink? = try {
        zaakInstanceLinkService.getByDocumentId(documentId)
    } catch (e: ZaakInstanceLinkNotFoundException) {
        logger.debug { "No zaak linked to document '$documentId'. Skipping behandelaar sync." }
        null
    }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
