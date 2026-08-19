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

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentValidator

/**
 * Validates the `removeBuildingBlock` component of a plan before it is saved: every entry has to name
 * the building block **version** it dissolves ([RemoveBuildingBlockVersionChecker]).
 *
 * The twin of [AddBuildingBlockMigrationComponentValidator], and for the same reason — a plan is only
 * free to fix before it runs. What cannot be checked here is whether the versions an entry names are the
 * ones the fleet is actually on: that is a per-instance runtime fact, and
 * [RemoveBuildingBlockMigrationComponentExecutor] is where it is caught.
 */
class RemoveBuildingBlockMigrationComponentValidator(
    private val removeBuildingBlockVersionChecker: RemoveBuildingBlockVersionChecker,
) : MigrationComponentValidator {

    override fun componentKey() = RemoveBuildingBlockMigrationComponentDeployer.REMOVE_BUILDING_BLOCK_COMPONENT_KEY

    override fun validate(source: BlueprintId, target: BlueprintId, component: JsonNode): List<String> {
        return removeBuildingBlockVersionChecker.findVersionless(component)
    }
}
