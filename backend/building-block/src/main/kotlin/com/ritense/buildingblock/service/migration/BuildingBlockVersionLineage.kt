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

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintVersionLineage
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver

/** Which version a building block version was derived from — all this module contributes to the migration engine. It deliberately does not implement [MigrationCandidateProvider]: a building block plan has no run of its own. */
class BuildingBlockVersionLineage(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
) : BlueprintVersionLineage {

    override fun supports(blueprintType: BlueprintType) = blueprintType == BlueprintType.BUILDING_BLOCK

    override fun basedOnVersionTag(blueprintId: BlueprintId): Semver? {
        return buildingBlockDefinitionRepository.findById(blueprintId as BuildingBlockDefinitionId)
            .orElse(null)?.basedOnVersionTag
    }

    override fun exists(blueprintId: BlueprintId): Boolean {
        return buildingBlockDefinitionRepository.existsById(blueprintId as BuildingBlockDefinitionId)
    }

    override fun deployedVersionTags(blueprintId: BlueprintId): List<Semver> {
        return buildingBlockDefinitionRepository.findAllByIdKeyOrderByIdVersionTag(blueprintId.getIdKey())
            .map { it.id.versionTag }
    }
}
