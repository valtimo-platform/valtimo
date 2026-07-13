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
import com.ritense.buildingblock.domain.migration.AddBuildingBlockConfiguration
import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.buildingblock.repository.AddBuildingBlockConfigurationRepository
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer
import org.springframework.transaction.annotation.Transactional

/**
 * Handles the `addBuildingBlock` component of a migration plan. This is the `building-block`
 * module's contribution to the [MigrationComponentDeployer] bridge; the plan file itself is still
 * imported, exported and auto-deployed by the `case` module, which dispatches this section here.
 */
@Transactional
class AddBuildingBlockMigrationComponentDeployer(
    private val objectMapper: ObjectMapper,
    private val addBuildingBlockConfigurationRepository: AddBuildingBlockConfigurationRepository,
) : MigrationComponentDeployer {

    override fun componentKey() = ADD_BUILDING_BLOCK_COMPONENT_KEY

    override fun deploy(migrationId: BlueprintMigrationId, component: JsonNode) {
        val instructions: List<AddBuildingBlockInstruction> = objectMapper.convertValue(
            component,
            object : TypeReference<List<AddBuildingBlockInstruction>>() {}
        )
        addBuildingBlockConfigurationRepository.save(AddBuildingBlockConfiguration(migrationId, instructions))
    }

    override fun undeploy(migrationId: BlueprintMigrationId) {
        addBuildingBlockConfigurationRepository.findById(migrationId).ifPresent {
            addBuildingBlockConfigurationRepository.delete(it)
        }
    }

    override fun getComponentToExport(migrationId: BlueprintMigrationId): Any? {
        return addBuildingBlockConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .filter { it.isNotEmpty() }
            .orElse(null)
    }

    companion object {
        const val ADD_BUILDING_BLOCK_COMPONENT_KEY = "addBuildingBlock"
    }
}
