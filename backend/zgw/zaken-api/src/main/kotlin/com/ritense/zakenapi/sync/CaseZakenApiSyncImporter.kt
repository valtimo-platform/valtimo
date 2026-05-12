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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.catalogiapi.service.CatalogiService
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.ZGW_ZAKEN_API_SYNC
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.event.CaseConfigurationIssueDetectedEvent
import com.ritense.valtimo.contract.event.CaseConfigurationIssueResolvedEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Transactional

@Transactional
class CaseZakenApiSyncImporter(
    private val objectMapper: ObjectMapper,
    private val caseZakenApiSyncRepository: CaseZakenApiSyncRepository,
    private val catalogiService: CatalogiService,
    private val applicationEventPublisher: ApplicationEventPublisher,
) : Importer {

    override fun type(): String = ZGW_ZAKEN_API_SYNC

    override fun dependsOn(): Set<String> = setOf(DOCUMENT_DEFINITION)

    override fun supports(fileName: String): Boolean = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        logger.info { "Importing zaken-api sync configuration for file ${request.fileName}" }
        val caseDefinitionId = request.caseDefinitionId!!
        val content = request.content.toString(Charsets.UTF_8)
        val syncRequest: CaseZakenApiSyncRequest = objectMapper.readValue(content)
        caseZakenApiSyncRepository.save(syncRequest.toEntity(caseDefinitionId))
        checkForConfigurationIssues(caseDefinitionId, syncRequest)
    }

    private fun checkForConfigurationIssues(
        caseDefinitionId: CaseDefinitionId,
        syncRequest: CaseZakenApiSyncRequest,
    ) {
        val hasIssue = syncRequest.assigneeSyncEnabled && !roltypeUrlIsValid(caseDefinitionId, syncRequest)

        val event = if (hasIssue) {
            CaseConfigurationIssueDetectedEvent(caseDefinitionId, ISSUE_TYPE)
        } else {
            CaseConfigurationIssueResolvedEvent(caseDefinitionId, ISSUE_TYPE)
        }
        applicationEventPublisher.publishEvent(event)
    }

    private fun roltypeUrlIsValid(
        caseDefinitionId: CaseDefinitionId,
        syncRequest: CaseZakenApiSyncRequest,
    ): Boolean {
        val roltypeUrl = syncRequest.roltypeUrl ?: return false
        return try {
            catalogiService.getRoltypes(caseDefinitionId)
                .any { it.url == roltypeUrl }
        } catch (e: Exception) {
            logger.warn(e) { "Could not validate roltype URL for caseDefinitionId=$caseDefinitionId" }
            false
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        val FILENAME_REGEX = """/zgw/zaken-api-sync/([^/]+)\.zaken-api-sync\.json""".toRegex()
        const val ISSUE_TYPE = "zaken-api-sync"
    }
}
