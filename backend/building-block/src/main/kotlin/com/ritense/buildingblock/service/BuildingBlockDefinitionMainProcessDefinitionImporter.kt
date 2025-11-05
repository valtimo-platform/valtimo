package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.BuildingBlockDefinitionMainProcessDefinitionDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.service.OperatonProcessService

class BuildingBlockDefinitionMainProcessDefinitionImporter(
    private val objectMapper: ObjectMapper,
    private val operatonProcessService: OperatonProcessService,
    private val buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
) : Importer {
    override fun type() = ValtimoImportTypes.Companion.BUILDING_BLOCK_MAIN_PROCESS_DEFINITION

    override fun dependsOn(): Set<String> = setOf(ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val dto = toDto(request.content.toString(Charsets.UTF_8))

        val definitionsByKeyAndSolutionModule = operatonProcessService.getDefinitionsByKeyAndSolutionModule(
            request.buildingBlockDefinitionId!!,
            dto.processDefinitionKey
        )

        if (definitionsByKeyAndSolutionModule.isNotEmpty()) {
            val definitionId = definitionsByKeyAndSolutionModule.first().id
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