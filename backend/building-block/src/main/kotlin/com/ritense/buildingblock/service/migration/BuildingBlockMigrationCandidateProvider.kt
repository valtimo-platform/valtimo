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
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.MigrationCandidateProvider
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Slice
import java.util.UUID

/**
 * Enumerates the candidate instances for a building block migration plan: the building block
 * instances of the given source building block definition version (key + version), paged by their
 * own document id. That document id is what the `dataMigration` executor operates on, and what the
 * building block `processMigration` executor uses to find the instance's running process.
 */
class BuildingBlockMigrationCandidateProvider(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
) : MigrationCandidateProvider {

    override fun supports(blueprintType: BlueprintType) = blueprintType == BlueprintType.BUILDING_BLOCK

    override fun basedOnVersionTag(blueprintId: BlueprintId): Semver? {
        return buildingBlockDefinitionRepository.findById(blueprintId as BuildingBlockDefinitionId)
            .orElse(null)?.basedOnVersionTag
    }

    override fun findCandidateIds(source: BlueprintId, pageable: Pageable): Slice<UUID> {
        return buildingBlockInstanceRepository.findDocumentIdsByDefinitionId(
            source as BuildingBlockDefinitionId, pageable
        )
    }
}
