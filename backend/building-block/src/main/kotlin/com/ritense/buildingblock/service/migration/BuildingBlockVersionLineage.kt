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

/**
 * Resolves which building block definition version a version was derived from, so a building block
 * migration plan knows — and can display — the version it migrates instances *from*.
 *
 * Lineage is all the `building-block` module contributes to the migration engine. It deliberately
 * does **not** implement
 * [com.ritense.valtimo.contract.blueprint.migration.MigrationCandidateProvider]: enumerating every
 * instance of a building block version is how a plan run picks its work, and a building block plan has
 * no run of its own. Its instances are chosen by [BuildingBlockVersionAlignmentExecutor] from the links
 * on the *owner's* new version, one migrating owner at a time. A global scan would migrate blocks under
 * cases that have not migrated and may never migrate — the model this design replaced.
 */
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
