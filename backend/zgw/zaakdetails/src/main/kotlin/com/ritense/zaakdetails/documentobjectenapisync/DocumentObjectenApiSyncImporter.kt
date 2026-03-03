/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.zaakdetails.documentobjectenapisync

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.ZGW_ZAAKDETAIL_SYNC
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.annotation.Transactional

@Transactional
class DocumentObjectenApiSyncImporter(
    private val objectMapper: ObjectMapper,
    private val documentObjectenApiSyncRepository: DocumentObjectenApiSyncRepository
) : Importer {

    override fun type(): String = ZGW_ZAAKDETAIL_SYNC

    override fun dependsOn(): Set<String> = setOf(DOCUMENT_DEFINITION)

    override fun supports(fileName: String): Boolean = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        logger.info { "Importing zaakdetail sync configuration for file ${request.fileName}" }
        deploy(request.caseDefinitionId!!, request.content.toString(Charsets.UTF_8))
    }

    private fun deploy(caseDefinitionId: CaseDefinitionId, content: String) {
        val syncRequest: DocumentObjectenApiSyncRequest = objectMapper.readValue(content)

        val existingSync = documentObjectenApiSyncRepository.findByCaseDefinitionId(caseDefinitionId)
        val syncToSave = if (existingSync != null) {
            existingSync.copy(
                objectManagementConfigurationId = syncRequest.objectManagementConfigurationId,
                enabled = syncRequest.enabled
            )
        } else {
            syncRequest.toEntity(caseDefinitionId)
        }

        documentObjectenApiSyncRepository.save(syncToSave)
    }

    private companion object {
        private val logger = KotlinLogging.logger {}
        val FILENAME_REGEX = """/zgw/zaakdetail-sync/([^/]+)\.zaakdetail-sync\.json""".toRegex()
    }
}
