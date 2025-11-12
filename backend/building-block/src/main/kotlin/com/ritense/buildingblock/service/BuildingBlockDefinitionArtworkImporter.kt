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

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionArtworkDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_ARTWORK
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_DEFINITION
import java.util.Base64

class BuildingBlockDefinitionArtworkImporter(
    private val buildingBlockDefinitionArtworkService: BuildingBlockDefinitionArtworkService
) : Importer {

    override fun type() = BUILDING_BLOCK_ARTWORK

    override fun dependsOn(): Set<String> = setOf(BUILDING_BLOCK_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val buildingBlockDefinitionId = requireNotNull(request.buildingBlockDefinitionId) {
            "BuildingBlockDefinitionId is required for artwork import"
        }

        val base64 = Base64.getEncoder().encodeToString(request.content)
        val dto = CreateBuildingBlockDefinitionArtworkDto(imageBase64 = base64)

        runWithoutAuthorization {
            buildingBlockDefinitionArtworkService.createArtwork(
                buildingBlockDefinitionId.key,
                buildingBlockDefinitionId.versionTag.toString(),
                dto
            )
        }
    }

    override fun partOfCaseDefinition() = false

    override fun partOfBuildingBlockDefinition() = true

    private companion object {
        val FILENAME_REGEX = """/building-block/artwork\.png""".toRegex()
    }
}