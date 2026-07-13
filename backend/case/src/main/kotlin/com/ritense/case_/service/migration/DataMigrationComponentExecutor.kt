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

import com.ritense.case_.repository.DataMigrationConfigurationRepository
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valueresolver.ValueResolverService
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.jvm.optionals.getOrNull

/**
 * Executes the `dataMigration` component for a single case using value resolvers only:
 * `resolveValues` reads the source paths and `handleValues` writes the target paths against the
 * case document. Reading/writing the document itself is delegated to the [ValueResolverService]
 * (through [MigrationDataPatchApplier]), so this executor never touches the document store directly.
 * Runs in the caller's transaction.
 *
 * The document is already re-homed to the target blueprint version by the migration engine before
 * this runs (so `handleValues` writes/validates against the target schema); this executor only
 * moves the values — source and target are the same document (the case).
 */
@Transactional
class DataMigrationComponentExecutor(
    private val dataMigrationConfigurationRepository: DataMigrationConfigurationRepository,
    private val dataPatchApplier: MigrationDataPatchApplier,
) : MigrationComponentExecutor {

    override fun componentKey() = DataMigrationComponentDeployer.DATA_MIGRATION_COMPONENT_KEY

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, caseId: UUID) {
        val patches = dataMigrationConfigurationRepository.findById(migrationId).getOrNull()?.patches
        if (patches.isNullOrEmpty()) {
            return
        }
        dataPatchApplier.apply(patches, caseId, caseId)
    }
}
