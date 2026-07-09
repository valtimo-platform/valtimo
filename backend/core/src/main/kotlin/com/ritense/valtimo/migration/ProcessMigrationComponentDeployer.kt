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

package com.ritense.valtimo.migration

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer
import com.ritense.valtimo.migration.domain.ProcessMigrationConfiguration
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import com.ritense.valtimo.migration.repository.ProcessMigrationConfigurationRepository
import org.springframework.transaction.annotation.Transactional

/**
 * Handles the `processMigration` component of a migration plan. This is the `core` module's
 * contribution to the [MigrationComponentDeployer] bridge; the migration plan file itself is still
 * imported, exported and auto-deployed by the `case` module, which dispatches this section here.
 */
@Transactional
class ProcessMigrationComponentDeployer(
    private val objectMapper: ObjectMapper,
    private val processMigrationConfigurationRepository: ProcessMigrationConfigurationRepository,
) : MigrationComponentDeployer {

    override fun componentKey() = PROCESS_MIGRATION_COMPONENT_KEY

    override fun deploy(migrationId: BlueprintMigrationId, component: JsonNode) {
        val instructions: List<ProcessMigrationInstruction> = objectMapper.convertValue(
            component,
            object : TypeReference<List<ProcessMigrationInstruction>>() {}
        )
        processMigrationConfigurationRepository.save(ProcessMigrationConfiguration(migrationId, instructions))
    }

    override fun undeploy(migrationId: BlueprintMigrationId) {
        processMigrationConfigurationRepository.findById(migrationId).ifPresent {
            processMigrationConfigurationRepository.delete(it)
        }
    }

    override fun getComponentToExport(migrationId: BlueprintMigrationId): Any? {
        return processMigrationConfigurationRepository.findById(migrationId)
            .map { it.instructions }
            .filter { it.isNotEmpty() }
            .orElse(null)
    }

    companion object {
        const val PROCESS_MIGRATION_COMPONENT_KEY = "processMigration"
    }
}
