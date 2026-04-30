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

package com.ritense.processlink.importer

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.importer.ValtimoImportTypes.Companion.GLOBAL_PROCESS_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.GLOBAL_PROCESS_LINK
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Transactional

@Transactional
class GlobalProcessLinkImporter(
    private val processLinkService: ProcessLinkService,
    repositoryService: OperatonRepositoryService,
    processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    objectMapper: ObjectMapper,
    processLinkMappers: List<ProcessLinkMapper>,
    applicationEventPublisher: ApplicationEventPublisher,
) : ProcessLinkImporter(processLinkService, repositoryService, processDefinitionCaseDefinitionService, objectMapper, processLinkMappers, applicationEventPublisher) {
    override fun type() = GLOBAL_PROCESS_LINK

    override fun dependsOn(): Set<String> {
        return setOf(GLOBAL_PROCESS_DEFINITION) +
            processLinkService.getImporterDependsOnTypes()
    }

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun partOfCaseDefinition() : Boolean = false

    override fun getFilenameRegexToImport(): Regex {
        return FILENAME_REGEX
    }

    private companion object {
        val FILENAME_REGEX = """/global/process-link/(?:.*/)?(.+)\.process-link\.json""".toRegex()
    }
}