package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_DEFINITION
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import io.github.oshai.kotlinlogging.KotlinLogging

// TODO: ensure these importers run before case definition importers do
class BuildingBlockDefinitionImporter(
    private val objectMapper: ObjectMapper,
    private val repository: BuildingBlockDefinitionRepository,
    private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker
) : Importer {
    override fun type() = BUILDING_BLOCK_DEFINITION

    override fun dependsOn(): Set<String> = emptySet()

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val buildingBlockDefinitionDto = toDefinitionDto(request.content.toString(Charsets.UTF_8))
        val buildingBlockDefinitionId = buildingBlockDefinitionDto.getBuildingBlockDefinitionId()
        buildingBlockDefinitionChecker.assertCanCreateOrUpdateBuildingBlockDefinition(
            buildingBlockDefinitionId,
            buildingBlockDefinitionDto.final
        )

        val buildingBlockDefinition = buildingBlockDefinitionDto.toEntity().copy(final = false)

        logger.debug { "Deploying building block with id '${buildingBlockDefinition.id}'" }

        repository.save(buildingBlockDefinition)

        logger.debug { "Building block with id '${buildingBlockDefinition.id}' was saved" }
    }

    override fun partOfCaseDefinition() = false

    override fun partOfBuildingBlockDefinition() = true

    private fun toDefinitionDto(fileContent: String): BuildingBlockDefinitionDto {
        return try {
            objectMapper.readValue(fileContent, BuildingBlockDefinitionDto::class.java)
        } catch (e: Exception) {
            throw IllegalArgumentException(
                "Failed to parse file content as a valid building block definition: ${e.message}",
                e
            )
        }
    }

    private companion object {
        val logger = KotlinLogging.logger {}
        val FILENAME_REGEX = """/building-block/definition/([^/]+)\.building-block-definition\.json""".toRegex()
    }
}