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
import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.document.CaseDocumentResolver
import com.ritense.valtimo.contract.event.NoteCreatedEvent
import com.ritense.valtimo.contract.event.NoteDeletedEvent
import com.ritense.valtimo.contract.event.NoteUpdatedEvent
import com.ritense.zakenapi.service.ZaakNotitieService
import com.ritense.zakenapi.sync.CaseZakenApiSync
import com.ritense.zakenapi.sync.CaseZakenApiSyncManagementService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.event.EventListener
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Transactional
@SkipComponentScan
class ZaakNotitieEventListener(
    private val zaakNotitieService: ZaakNotitieService,
    private val caseZakenApiSyncManagementService: CaseZakenApiSyncManagementService,
    private val documentService: DocumentService,
    private val caseDocumentResolver: CaseDocumentResolver,
) {

    @RunWithoutAuthorization
    @EventListener(NoteCreatedEvent::class)
    fun handleNoteCreatedEvent(event: NoteCreatedEvent) {
        logger.debug { "Note created event received: $event" }
        val syncConfig = resolveActiveSyncConfig(event.noteDocumentId!!)
            ?: return
        zaakNotitieService.createZaakNotitieFrom(event, syncConfig.noteSubject)
    }

    @RunWithoutAuthorization
    @EventListener(NoteUpdatedEvent::class)
    fun handleNoteUpdatedEvent(event: NoteUpdatedEvent) {
        logger.debug { "Note updated event received: $event" }
        val syncConfig = resolveActiveSyncConfig(event.noteDocumentId!!)
            ?: return
        zaakNotitieService.updateZaakNotitieFrom(event, syncConfig.noteSubject)
    }

    @RunWithoutAuthorization
    @EventListener(NoteDeletedEvent::class)
    fun handleNoteDeletedEvent(event: NoteDeletedEvent) {
        logger.debug { "Note deleted event received: $event" }
        resolveActiveSyncConfig(event.noteDocumentId!!)
            ?: return
        zaakNotitieService.deleteZaakNotitieFrom(event)
    }

    private fun resolveActiveSyncConfig(documentId: UUID): CaseZakenApiSync? {
        val caseDefinitionId = resolveCaseDefinitionId(documentId)
        val syncConfig = caseZakenApiSyncManagementService.getSyncConfiguration(caseDefinitionId)
        if (syncConfig?.noteSyncEnabled != true) {
            logger.debug { "> Ignoring event as note sync is disabled for case definition '$caseDefinitionId'" }
            return null
        }
        return syncConfig
    }

    private fun resolveCaseDefinitionId(documentId: UUID): CaseDefinitionId =
        runWithoutAuthorization {
            val caseDocumentId = caseDocumentResolver.resolveCaseDocumentId(documentId)
            documentService[caseDocumentId.toString()].definitionId().caseDefinitionId()
        }

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}
