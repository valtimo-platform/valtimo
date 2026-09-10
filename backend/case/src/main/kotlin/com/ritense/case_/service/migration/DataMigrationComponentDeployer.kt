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

package com.ritense.case_.service.migration

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.domain.migration.DataMigrationConfiguration
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.case_.repository.DataMigrationConfigurationRepository
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentDeployer
import org.springframework.transaction.annotation.Transactional

/** The `case` module's contribution to [MigrationComponentDeployer] for `dataMigration`. */
@Transactional
class DataMigrationComponentDeployer(
    private val objectMapper: ObjectMapper,
    private val dataMigrationConfigurationRepository: DataMigrationConfigurationRepository,
) : MigrationComponentDeployer {

    override fun componentKey() = DATA_MIGRATION_COMPONENT_KEY

    override fun deploy(migrationId: BlueprintMigrationId, component: JsonNode) {
        val patches: List<DataMigrationPatch> = objectMapper.convertValue(
            component,
            object : TypeReference<List<DataMigrationPatch>>() {}
        )
        dataMigrationConfigurationRepository.save(DataMigrationConfiguration(migrationId, patches))
    }

    override fun undeploy(migrationId: BlueprintMigrationId) {
        dataMigrationConfigurationRepository.findById(migrationId).ifPresent {
            dataMigrationConfigurationRepository.delete(it)
        }
    }

    override fun getComponentToExport(migrationId: BlueprintMigrationId): Any? {
        return dataMigrationConfigurationRepository.findById(migrationId)
            .map { it.patches }
            .filter { it.isNotEmpty() }
            .orElse(null)
    }

    companion object {
        const val DATA_MIGRATION_COMPONENT_KEY = "dataMigration"
    }
}
