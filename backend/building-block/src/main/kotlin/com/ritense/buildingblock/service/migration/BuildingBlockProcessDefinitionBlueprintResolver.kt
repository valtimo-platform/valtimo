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

package com.ritense.buildingblock.service.migration

import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.processdocument.migration.ProcessDefinitionBlueprintResolver
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

/** A building block version's process definitions, via the building block ↔ process-definition link — the `BUILDING_BLOCK` side of the type-agnostic suggester. */
class BuildingBlockProcessDefinitionBlueprintResolver(
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
) : ProcessDefinitionBlueprintResolver {

    override fun supports(blueprintType: BlueprintType) = blueprintType == BlueprintType.BUILDING_BLOCK

    override fun resolveProcessDefinitions(blueprintId: BlueprintId): Map<String, String> =
        processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(blueprintId as BuildingBlockDefinitionId)
            .mapNotNull { link -> link.processDefinitionKey?.let { key -> key to link.id.processDefinitionId.id } }
            .toMap()
}
