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
import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator

/**
 * Validates the `addBuildingBlock` component of a plan before it is saved: every building block
 * version it creates has to be one the target blueprint version links (see [AddBuildingBlockLinkChecker]
 * for why). Rejecting the plan on save is the only moment the mistake is still free to fix — once the
 * migration has run, the wrongly-versioned instances exist.
 */
class AddBuildingBlockMigrationComponentValidator(
    private val objectMapper: ObjectMapper,
    private val addBuildingBlockLinkChecker: AddBuildingBlockLinkChecker,
) : MigrationComponentValidator {

    override fun componentKey() = AddBuildingBlockMigrationComponentDeployer.ADD_BUILDING_BLOCK_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
        val instructions: List<AddBuildingBlockInstruction> = objectMapper.convertValue(
            component,
            object : TypeReference<List<AddBuildingBlockInstruction>>() {},
        )
        return addBuildingBlockLinkChecker.findUnlinked(target, instructions)
    }
}
