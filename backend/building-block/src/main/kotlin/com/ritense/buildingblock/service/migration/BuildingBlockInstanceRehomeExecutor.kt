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

import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentExecutor
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.core.annotation.Order
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/** Keeps a migrating block instance's version in step with its document — the engine re-homes the document, so without this a migrated block kept claiming its old version and stayed eligible for the same migration. Has no plan section of its own. */
// Order 50 — before every other component, so the rest of the migration sees the instance on its target version.
@Order(50)
@Transactional
class BuildingBlockInstanceRehomeExecutor(
    private val buildingBlockInstanceRehomer: BuildingBlockInstanceRehomer,
) : MigrationComponentExecutor {

    override fun componentKey() = COMPONENT_KEY

    override fun execute(migrationId: BlueprintMigrationId, target: BlueprintId, ownerDocumentId: UUID) {
        if (target.blueprintType() != BlueprintType.BUILDING_BLOCK) {
            return // a case document has no building block instance to re-point
        }
        buildingBlockInstanceRehomer.rehome(ownerDocumentId, target as BuildingBlockDefinitionId)
    }

    companion object {
        const val COMPONENT_KEY = "buildingBlockInstanceRehome"
    }
}
