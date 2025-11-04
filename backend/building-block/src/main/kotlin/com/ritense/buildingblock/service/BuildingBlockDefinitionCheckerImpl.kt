package com.ritense.buildingblock.service

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionSpecificationHelper.Companion.byBuildingBlockDefinitionKey
import com.ritense.importer.ImportContext
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.core.env.Environment

class BuildingBlockDefinitionCheckerImpl(
    private val repository: BuildingBlockDefinitionRepository,
    private val environment: Environment,
    private val draftEnvironments: String,
    private val draftsEnabled: Boolean,
) : BuildingBlockDefinitionChecker {
    override fun existsBuildingBlockDefinition(buildingBlockDefinitionId: BuildingBlockDefinitionId): Boolean {
        return repository.findById(buildingBlockDefinitionId) != null
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
            repository.findById(buildingBlockDefinitionId) != null
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
        requireNotNull(repository.findById(buildingBlockDefinitionId)) { "BuildingBlock $buildingBlockDefinitionId does not exist." }
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