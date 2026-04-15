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

package com.ritense.buildingblock.web.rest.dto

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import java.util.UUID

data class CaseDefinitionBuildingBlockLinkDto(
    val id: UUID,
    val caseDefinitionKey: String,
    val caseDefinitionVersionTag: String,
    val buildingBlockDefinitionKey: String,
    val buildingBlockDefinitionVersionTag: String,
    val inputMappings: List<BuildingBlockInputMapping>,
    val outputMappings: List<BuildingBlockOutputMapping>,
    val pluginConfigurationMappings: Map<String, UUID>
) {
    companion object {
        fun from(entity: CaseDefinitionBuildingBlockLink): CaseDefinitionBuildingBlockLinkDto {
            return CaseDefinitionBuildingBlockLinkDto(
                id = entity.id,
                caseDefinitionKey = entity.caseDefinitionId.key,
                caseDefinitionVersionTag = entity.caseDefinitionId.versionTag.toString(),
                buildingBlockDefinitionKey = entity.buildingBlockDefinitionId.key,
                buildingBlockDefinitionVersionTag = entity.buildingBlockDefinitionId.versionTag.toString(),
                inputMappings = entity.inputMappings,
                outputMappings = entity.outputMappings,
                pluginConfigurationMappings = entity.pluginConfigurationMappings
            )
        }
    }
}

data class CreateCaseDefinitionBuildingBlockLinkDto(
    val buildingBlockDefinitionKey: String,
    val buildingBlockDefinitionVersionTag: String,
    val inputMappings: List<BuildingBlockInputMapping> = emptyList(),
    val outputMappings: List<BuildingBlockOutputMapping> = emptyList(),
    val pluginConfigurationMappings: Map<String, UUID> = emptyMap()
)

data class UpdateCaseDefinitionBuildingBlockLinkDto(
    val inputMappings: List<BuildingBlockInputMapping> = emptyList(),
    val outputMappings: List<BuildingBlockOutputMapping> = emptyList(),
    val pluginConfigurationMappings: Map<String, UUID> = emptyMap()
)
