/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.contract.buildingblock

interface BuildingBlockDefinitionChecker {

    fun existsBuildingBlockDefinition(buildingBlockDefinitionId: BuildingBlockDefinitionId): Boolean = false

    fun existsBuildingBlockDefinition(buildingBlockDefinitionKey: String): Boolean = false

    fun canUpdateBuildingBlockDefinition(buildingBlockDefinitionId: BuildingBlockDefinitionId): Boolean = false

    fun canUpdateGlobalConfiguration(): Boolean = false

    fun assertBuildingBlockDefinitionExists(buildingBlockDefinitionId: BuildingBlockDefinitionId) {
        require(existsBuildingBlockDefinition(buildingBlockDefinitionId)) { "BuildingBlockDefinition $buildingBlockDefinitionId does not exist. Missing buildingBlock library" }
    }

    fun assertBuildingBlockDefinitionExists(buildingBlockDefinitionKey: String) {
        require(existsBuildingBlockDefinition(buildingBlockDefinitionKey)) { "BuildingBlockDefinition $buildingBlockDefinitionKey does not exist. Missing buildingBlock library" }
    }

    fun assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId: BuildingBlockDefinitionId) {
        require(canUpdateBuildingBlockDefinition(buildingBlockDefinitionId)) { "BuildingBlockDefinition $buildingBlockDefinitionId can't be updated. Missing buildingBlock library" }
    }

    fun assertCanUpdateGlobalConfiguration() {
        require(canUpdateGlobalConfiguration()) { "Configuration can't be updated. Missing buildingBlock library" }
    }

    fun assertCanCreateOrUpdateBuildingBlockDefinition(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        final: Boolean
    ) {
        require(canUpdateGlobalConfiguration()) { "BuildingBlock can't be updated. Missing buildingBlock library" }
    }
}