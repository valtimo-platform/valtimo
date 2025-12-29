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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.databind.node.TextNode
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_LINK
import com.ritense.logging.withLoggingContext
import com.ritense.plugin.domain.PluginConfigurationReferenceType
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.exception.ProcessLinkExistsException
import com.ritense.processlink.service.ProcessLinkService
import org.springframework.transaction.annotation.Transactional

@Transactional
class BuildingBlockProcessLinkImporter(
    private val processLinkService: ProcessLinkService,
    private val objectMapper: ObjectMapper,
    private val buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService
) : Importer {

    override fun type() = BUILDING_BLOCK_PROCESS_LINK

    override fun dependsOn(): Set<String> {
        return setOf(BUILDING_BLOCK_PROCESS_DEFINITION) +
            processLinkService.getImporterDependsOnTypes()
    }

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val processDefinitionKey = getFilenameRegexToImport().matchEntire(request.fileName)!!.groupValues[1]

        val buildingBlockDefinitionId = request.buildingBlockDefinitionId ?: return;

        withLoggingContext("processDefinitionKey", processDefinitionKey) {
            val processDefinitions = buildingBlockDefinitionProcessDefinitionService.getProcessDefinitionsForBuildingBlock(
                buildingBlockDefinitionId.key,
                buildingBlockDefinitionId.versionTag.toString()
            )

            val processDefinitionId = processDefinitions
                .firstOrNull { it.key == processDefinitionKey }
                ?.id
                ?: throw IllegalStateException(
                    "Error while deploying '${request.fileName}'. Could not find Process definition with key '$processDefinitionKey' for building block '$buildingBlockDefinitionId'."
                )

            val jsonTree = objectMapper.readTree(request.content.toString(Charsets.UTF_8))
            require(jsonTree is ArrayNode)

            jsonTree.forEach { node ->
                require(node is ObjectNode)

                node.set<ObjectNode>(
                    "referenceType",
                    TextNode.valueOf(PluginConfigurationReferenceType.BUILDING_BLOCK.name)
                )
                node.remove("pluginConfigurationId")

                node.set<ObjectNode>("processDefinitionId", TextNode.valueOf(processDefinitionId))

                val deployDto = objectMapper.treeToValue<ProcessLinkDeployDto>(node)
                val mapper = processLinkService.getProcessLinkMapper(deployDto.processLinkType)
                val createDto = mapper.toProcessLinkCreateRequestDto(deployDto)

                try {
                    processLinkService.createProcessLink(createDto, request.caseDefinitionId)
                } catch (e: ProcessLinkExistsException) {
                    val updateDto = mapper.toProcessLinkUpdateRequestDto(deployDto, e.existingProcessLinkId)
                    processLinkService.updateProcessLink(updateDto, request.caseDefinitionId)
                }
            }
        }
    }

    override fun partOfCaseDefinition() = false

    override fun partOfBuildingBlockDefinition() = true

    protected fun getFilenameRegexToImport(): Regex = FILENAME_REGEX

    private companion object {
        val FILENAME_REGEX = """/process-link/(?:.*/)?(.+)\.process-link\.json""".toRegex()
    }
}