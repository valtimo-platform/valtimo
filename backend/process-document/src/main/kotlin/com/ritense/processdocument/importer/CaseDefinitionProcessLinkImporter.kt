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

package com.ritense.processdocument.importer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION_PROCESS_LINK
import com.ritense.processdocument.domain.config.CaseDefinitionProcessLinkConfigItem
import com.ritense.processdocument.repository.CaseDefinitionProcessLinkRepository
import com.ritense.processdocument.domain.CaseDefinitionProcessLink
import com.ritense.processdocument.domain.CaseDefinitionProcessLinkId.Companion.newId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.annotation.Transactional

@Transactional
class CaseDefinitionProcessLinkImporter(
    private val caseDefinitionProcessLinkRepository: CaseDefinitionProcessLinkRepository,
    private val objectMapper: ObjectMapper,
) : Importer {

    override fun type() = CASE_DEFINITION_PROCESS_LINK

    override fun dependsOn() = setOf(CASE_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val caseDefinitionId = request.caseDefinitionId!!
        deploy(caseDefinitionId, request.content.toString(Charsets.UTF_8))
    }

    fun deploy(caseDefinitionId: CaseDefinitionId, content: String) {
        val configItems: List<CaseDefinitionProcessLinkConfigItem> = objectMapper.readValue(content)

        configItems.forEach { item ->
            val existing = caseDefinitionProcessLinkRepository.findByIdCaseDefinitionIdAndType(
                caseDefinitionId, item.linkType
            )
            if (existing != null) {
                caseDefinitionProcessLinkRepository.deleteByIdCaseDefinitionIdAndType(
                    caseDefinitionId, item.linkType
                )
            }

            logger.info { "Deploying case-definition-process-link: ${item.linkType} -> ${item.processDefinitionKey} for case ${caseDefinitionId.key}" }
            caseDefinitionProcessLinkRepository.save(
                CaseDefinitionProcessLink(
                    newId(caseDefinitionId, item.processDefinitionKey),
                    item.linkType
                )
            )
        }
    }

    companion object {
        private val FILENAME_REGEX = """/case-definition-process-link/[^/]+\.case-definition-process-link\.json""".toRegex()
        private val logger = KotlinLogging.logger {}
    }
}
