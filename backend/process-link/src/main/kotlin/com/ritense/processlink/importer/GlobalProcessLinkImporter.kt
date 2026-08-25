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
import com.fasterxml.jackson.databind.node.ArrayNode
import com.ritense.authorization.AuthorizationContext
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.GLOBAL_FORM
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
    private val objectMapper: ObjectMapper,
    processLinkMappers: List<ProcessLinkMapper>,
    applicationEventPublisher: ApplicationEventPublisher,
) : ProcessLinkImporter(
    processLinkService,
    repositoryService,
    processDefinitionCaseDefinitionService,
    objectMapper,
    processLinkMappers,
    applicationEventPublisher
) {
    override fun type() = GLOBAL_PROCESS_LINK

    /**
     * A process link cannot be created before the definition it points at is deployed. The
     * mappers report their case-scoped importer type; for the global path the process definition
     * and any bundled form are deployed by the global importers, so those are depended on
     * explicitly. This guarantees a bundled form is deployed before the form link referencing it.
     */
    override fun dependsOn(): Set<String> {
        return setOf(GLOBAL_PROCESS_DEFINITION, GLOBAL_FORM) +
            processLinkService.getImporterDependsOnTypes()
    }

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun partOfCaseDefinition() : Boolean = false

    /**
     * The imported file is the complete set of process links for the process definition, so process
     * links that are not in the file are removed. This applies both to importing an exported process
     * and to the autodeployment of `config/global/process-link`, which is authoritative.
     */
    override fun import(request: ImportRequest) {
        deleteProcessLinksNotIn(request)
        super.import(request)
    }

    private fun deleteProcessLinksNotIn(request: ImportRequest) {
        val jsonTree = objectMapper.readTree(request.content.toString(Charsets.UTF_8))
        if (jsonTree !is ArrayNode) {
            // Let the import itself report the invalid file
            return
        }

        val importedActivities = jsonTree.mapNotNull { node ->
            val activityId = node.path("activityId").asText(null) ?: return@mapNotNull null
            val activityType = node.path("activityType").asText(null) ?: return@mapNotNull null
            activityId to activityType
        }.toSet()

        val processDefinitionKey = getFilenameRegexToImport().matchEntire(request.fileName)!!.groupValues[1]
        val processDefinitionId = AuthorizationContext.runWithoutAuthorization {
            resolveProcessDefinitionId(request, processDefinitionKey)
        }

        processLinkService.getProcessLinks(processDefinitionId)
            .filter { (it.activityId to it.activityType.value) !in importedActivities }
            .forEach { processLinkService.deleteProcessLink(it.id) }
    }

    override fun getFilenameRegexToImport(): Regex {
        return FILENAME_REGEX
    }

    private companion object {
        val FILENAME_REGEX = """/global/process-link/(?:.*/)?(.+)\.process-link\.json""".toRegex()
    }
}
