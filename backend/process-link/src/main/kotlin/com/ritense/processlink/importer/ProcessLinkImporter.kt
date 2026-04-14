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
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.databind.node.TextNode
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.ritense.authorization.AuthorizationContext
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.PROCESS_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.PROCESS_LINK
import com.ritense.logging.withLoggingContext
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.exception.ProcessLinkExistsException
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.annotation.Transactional

@Transactional
open class ProcessLinkImporter(
    private val processLinkService: ProcessLinkService,
    private val repositoryService: OperatonRepositoryService,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    private val objectMapper: ObjectMapper,
    private val processLinkMappers: List<ProcessLinkMapper>,
    private val applicationEventPublisher: ApplicationEventPublisher,
) : Importer {

    override fun type() = PROCESS_LINK

    override fun dependsOn(): Set<String> {
        return setOf(PROCESS_DEFINITION) + processLinkService.getImporterDependsOnTypes()
    }

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val processDefinitionKey = getFilenameRegexToImport().matchEntire(request.fileName)!!.groupValues[1]

        withLoggingContext("processDefinitionKey", processDefinitionKey) {
            val processDefinitionId = AuthorizationContext.runWithoutAuthorization {
                resolveProcessDefinitionId(request, processDefinitionKey)
            }

            val jsonTree = objectMapper.readTree(request.content.toString(Charsets.UTF_8))
            require(jsonTree is ArrayNode) {
                "Error while processing file ${request.fileName}. Expected root item to be an array!"
            }

            jsonTree.forEachIndexed { index, node ->
                require(node is ObjectNode) {
                    "Error while processing file ${request.fileName}. Expected item at index $index to be an object!"
                }

                if (!node.has("processDefinitionId")) {
                    node.set<ObjectNode>("processDefinitionId", TextNode.valueOf(processDefinitionId))
                }

                val mappings = request.pluginConfigurationMappings
                if (mappings != null && node.has("pluginConfigurationId")) {
                    val originalIdText = node.get("pluginConfigurationId").asText(null)
                    if (originalIdText != null) {
                        val originalId = java.util.UUID.fromString(originalIdText)
                        if (mappings.containsKey(originalId)) {
                            val mappedId = mappings[originalId]
                            if (mappedId != null) {
                                node.set<ObjectNode>("pluginConfigurationId", TextNode.valueOf(mappedId.toString()))
                            } else {
                                node.putNull("pluginConfigurationId")
                            }
                        }
                    }
                }

                val deployDto = objectMapper.treeToValue<ProcessLinkDeployDto>(node)

                val mapper = processLinkService.getProcessLinkMapper(deployDto.processLinkType)
                val createDto = mapper.toProcessLinkCreateRequestDto(deployDto, request.caseDefinitionId)

                try {
                    processLinkService.createProcessLink(createDto, request.caseDefinitionId)
                } catch (e: ProcessLinkExistsException) {
                    val updateDto = mapper.toProcessLinkUpdateRequestDto(deployDto, e.existingProcessLinkId, request.caseDefinitionId)
                    processLinkService.updateProcessLink(updateDto, request.caseDefinitionId)
                }
            }
        }
    }

    private fun resolveProcessDefinitionId(request: ImportRequest, processDefinitionKey: String): String {
        val caseDefinitionId = request.caseDefinitionId

        if (caseDefinitionId == null) {
            return repositoryService.findLatestProcessDefinition(processDefinitionKey)?.id
                ?: throw IllegalStateException(
                    "Error while deploying '${request.fileName}'. Could not find Process definition with key '$processDefinitionKey'."
                )
        }

        val caseLinks = processDefinitionCaseDefinitionService.findProcessDefinitionCaseDefinitions(caseDefinitionId)

        if (caseLinks.isEmpty()) {
            throw IllegalStateException(
                "Error while deploying '${request.fileName}'. No process definitions linked to case definition '$caseDefinitionId'."
            )
        }

        val candidates: List<OperatonProcessDefinition> = caseLinks
            .mapNotNull { repositoryService.findProcessDefinitionById(it.id.processDefinitionId.id) }
            .filter { it.key == processDefinitionKey }

        val latestCandidate = candidates.maxByOrNull { it.version }
            ?: throw IllegalStateException(
                "Error while deploying '${request.fileName}'. Could not find Process definition with key '$processDefinitionKey' linked to case definition '$caseDefinitionId'."
            )

        return latestCandidate.id
    }

    override fun afterImport(request: ImportRequest) {
        val caseDefinitionId = request.caseDefinitionId ?: return
        val processDefinitionIds = AuthorizationContext.runWithoutAuthorization {
            processDefinitionCaseDefinitionService
                .findProcessDefinitionCaseDefinitions(caseDefinitionId)
                .mapNotNull { repositoryService.findProcessDefinitionById(it.id.processDefinitionId.id)?.id }
                .toSet()
        }
        processLinkMappers.forEach { mapper ->
            mapper.afterImport(caseDefinitionId, processDefinitionIds, applicationEventPublisher)
        }
    }

    protected fun getFilenameRegexToImport(): Regex = FILENAME_REGEX

    private companion object {
        val FILENAME_REGEX = """/process-link/(?:.*/)?(.+)\.process-link\.json""".toRegex()
    }
}