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

package com.ritense.zakenapi.sync

import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.logging.LoggableResource
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.case_.CaseDefinitionChecker
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional
@Service
@SkipComponentScan
class DocumentZakenApiSyncManagementService(
    private val documentZakenApiSyncRepository: DocumentZakenApiSyncRepository,
    private val caseDefinitionChecker: CaseDefinitionChecker,
) {
    fun getSyncConfiguration(
        @LoggableResource(resourceType = CaseDefinition::class) caseDefinitionId: CaseDefinitionId
    ): DocumentZakenApiSync? {
        logger.debug { "Get zaken-api sync configuration caseDefinitionId=$caseDefinitionId" }
        return documentZakenApiSyncRepository.findByCaseDefinitionId(caseDefinitionId)
    }

    fun saveSyncConfiguration(sync: DocumentZakenApiSync) {
        logger.info { "Save zaken-api sync configuration caseDefinitionId=${sync.caseDefinitionId}" }
        require(sync.syncAssigneeAsBehandelaar || sync.noteSyncEnabled) {
            "At least one zaken-api sync option must be enabled"
        }
        caseDefinitionChecker.assertCanUpdateCaseDefinitionConfiguration(sync.caseDefinitionId, ISSUE_TYPE)
        val modifiedSync = getSyncConfiguration(sync.caseDefinitionId)
            ?.copy(
                syncAssigneeAsBehandelaar = sync.syncAssigneeAsBehandelaar,
                noteSyncEnabled = sync.noteSyncEnabled,
                noteSubject = sync.noteSubject,
            )
            ?: sync

        documentZakenApiSyncRepository.save(modifiedSync)
    }

    fun deleteSyncConfigurationByCaseDefinition(
        @LoggableResource(resourceType = CaseDefinition::class) caseDefinitionId: CaseDefinitionId
    ) {
        logger.info { "Delete zaken-api sync configuration caseDefinitionId=$caseDefinitionId" }
        caseDefinitionChecker.assertCanUpdateCaseDefinitionConfiguration(caseDefinitionId, ISSUE_TYPE)
        documentZakenApiSyncRepository.deleteByCaseDefinitionId(caseDefinitionId)
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        const val ISSUE_TYPE = "zaken-api-sync"
    }
}
