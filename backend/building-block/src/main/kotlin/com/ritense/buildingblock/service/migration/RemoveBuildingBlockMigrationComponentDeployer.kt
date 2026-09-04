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

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockConfiguration
import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockInstruction
import com.ritense.buildingblock.repository.RemoveBuildingBlockConfigurationRepository
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer
import org.springframework.transaction.annotation.Transactional

/** The `building-block` module's contribution to [MigrationComponentDeployer] for `removeBuildingBlock`; the plan file itself is still owned by the `case` module. */
@Transactional
class RemoveBuildingBlockMigrationComponentDeployer(
    private val objectMapper: ObjectMapper,
    private val removeBuildingBlockConfigurationRepository: RemoveBuildingBlockConfigurationRepository,
    private val removeBuildingBlockVersionChecker: RemoveBuildingBlockVersionChecker,
) : MigrationComponentDeployer {

    override fun componentKey() = REMOVE_BUILDING_BLOCK_COMPONENT_KEY

    override fun deploy(migrationId: BlueprintMigrationId, component: JsonNode) {
        // Ahead of parsing: without a version tag Jackson fails with a message about a Kotlin constructor parameter.
        removeBuildingBlockVersionChecker.assertVersioned(component)
        val instructions: List<RemoveBuildingBlockInstruction> = objectMapper.convertValue(
            component,
            object : TypeReference<List<RemoveBuildingBlockInstruction>>() {}
        )
        removeBuildingBlockConfigurationRepository.save(RemoveBuildingBlockConfiguration(migrationId, instructions))
    }

    override fun undeploy(migrationId: BlueprintMigrationId) {
        // Deletes without reading: a row stored before the version tag was required cannot be deserialised, and this is the path a corrected plan takes in.
        removeBuildingBlockConfigurationRepository.deleteByMigrationId(migrationId)
    }

    override fun getComponentToExport(migrationId: BlueprintMigrationId): Any? {
        return removeBuildingBlockConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .filter { it.isNotEmpty() }
            .orElse(null)
    }

    companion object {
        const val REMOVE_BUILDING_BLOCK_COMPONENT_KEY = "removeBuildingBlock"
    }
}
