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
import com.ritense.buildingblock.domain.BuildingBlockDefinitionMainProcessDefinitionDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_MAIN_PROCESS_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_DEFINITION
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.service.OperatonProcessService

class BuildingBlockDefinitionMainProcessDefinitionImporter(
    private val objectMapper: ObjectMapper,
    private val operatonProcessService: OperatonProcessService,
    private val buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
) : Importer {
    override fun type() = BUILDING_BLOCK_MAIN_PROCESS_DEFINITION

    override fun dependsOn(): Set<String> = setOf(BUILDING_BLOCK_PROCESS_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val dto = toDto(request.content.toString(Charsets.UTF_8))

        val definitionsByKeyAndBlueprint = operatonProcessService.getDefinitionsByKeyAndBlueprint(
            request.buildingBlockDefinitionId!!,
            dto.processDefinitionKey
        )

        if (definitionsByKeyAndBlueprint.isNotEmpty()) {
            val definitionId = definitionsByKeyAndBlueprint.first().id
            buildingBlockDefinitionProcessDefinitionService.setMainLink(
                request.buildingBlockDefinitionId!!,
                null,
                ProcessDefinitionId(definitionId),
                true
            )
        }
    }

    override fun partOfCaseDefinition() = false

    override fun partOfBuildingBlockDefinition() = true

    private fun toDto(fileContent: String): BuildingBlockDefinitionMainProcessDefinitionDto {
        return try {
            objectMapper.readValue(fileContent, BuildingBlockDefinitionMainProcessDefinitionDto::class.java)
        } catch (e: Exception) {
            throw IllegalArgumentException(
                "Failed to parse file content as a valid building block definition main process definition: ${e.message}",
                e
            )
        }
    }

    private companion object {
        val FILENAME_REGEX =
            """/building-block/building-block-definition-main-process-definition\.json""".toRegex()
    }
}