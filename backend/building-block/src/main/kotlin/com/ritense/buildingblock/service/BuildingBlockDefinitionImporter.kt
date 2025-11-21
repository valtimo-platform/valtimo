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

    override fun afterImport(request: ImportRequest) {
        val dto = toDefinitionDto(request.content.toString(Charsets.UTF_8))

        if (!dto.final) {
            return
        }

        val id = dto.getBuildingBlockDefinitionId()
        val existing = repository.findById(id).orElse(null) ?: return

        if (existing.final) {
            return
        }

        logger.debug { "Finalizing building block with id '$id' after import" }

        buildingBlockDefinitionChecker.assertCanCreateOrUpdateBuildingBlockDefinition(
            id,
            true
        )

        repository.save(existing.copy(final = true))
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