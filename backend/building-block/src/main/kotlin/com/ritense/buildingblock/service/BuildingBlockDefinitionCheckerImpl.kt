/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.service

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionSpecificationHelper.Companion.byBuildingBlockDefinitionKey
import com.ritense.importer.ImportContext
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.core.env.Environment
import org.springframework.data.repository.findByIdOrNull

class BuildingBlockDefinitionCheckerImpl(
    private val repository: BuildingBlockDefinitionRepository,
    private val environment: Environment,
    private val draftEnvironments: String,
    private val draftsEnabled: Boolean,
) : BuildingBlockDefinitionChecker {
    override fun existsBuildingBlockDefinition(buildingBlockDefinitionId: BuildingBlockDefinitionId): Boolean {
        return repository.findByIdOrNull(buildingBlockDefinitionId) != null
    }

    override fun existsBuildingBlockDefinition(buildingBlockDefinitionKey: String): Boolean {
        return repository.findOne(
            byBuildingBlockDefinitionKey(buildingBlockDefinitionKey)
        ) != null
    }

    override fun canUpdateBuildingBlockDefinition(buildingBlockDefinitionId: BuildingBlockDefinitionId): Boolean {
        return if (!canUpdateGlobalConfiguration()) {
            false
        } else {
            val definition = repository.findByIdOrNull(buildingBlockDefinitionId) ?: return false
            !definition.final
        }
    }

    override fun canUpdateGlobalConfiguration(): Boolean {
        if (ImportContext.isImporting()) {
            return true
        }
        return isDraftEnvironment()
    }

    override fun assertBuildingBlockDefinitionExists(buildingBlockDefinitionId: BuildingBlockDefinitionId) {
        require(existsBuildingBlockDefinition(buildingBlockDefinitionId)) { "BuildingBlock $buildingBlockDefinitionId does not exist." }
    }

    override fun assertBuildingBlockDefinitionExists(buildingBlockDefinitionKey: String) {
        require(existsBuildingBlockDefinition(buildingBlockDefinitionKey)) { "BuildingBlock $buildingBlockDefinitionKey does not exist." }
    }

    override fun assertCanUpdateBuildingBlockDefinition(buildingBlockDefinitionId: BuildingBlockDefinitionId) {
        assertCanUpdateGlobalConfiguration()
        val definition = repository.findByIdOrNull(buildingBlockDefinitionId)
            ?: error("BuildingBlock $buildingBlockDefinitionId does not exist.")
        require(!definition.final) {
            "Failed to update BuildingBlockDefinition $buildingBlockDefinitionId. This building block definition is final."
        }
    }

    override fun assertCanCreateOrUpdateBuildingBlockDefinition(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        final: Boolean
    ) {
        if (!isDraftEnvironment()) {
            error("Failed to create/update BuildingBlockDefinition $buildingBlockDefinitionId. This Valtimo environment does not support drafts. Missing one of the following Spring profiles: [$draftEnvironments]")
        }
    }

    override fun assertCanUpdateGlobalConfiguration() {
        require(canUpdateGlobalConfiguration()) {
            "Failed to update configuration. This Valtimo environment does not support drafts. Missing one of the following Spring profiles: [$draftEnvironments]"
        }
    }

    private fun isDraftEnvironment(): Boolean {
        return draftsEnabled || draftEnvironments.split(',').any { draftEnvironment ->
            environment.activeProfiles.any { it == draftEnvironment }
        }
    }
}