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
import com.ritense.valtimo.contract.blueprint.migration.BuildingBlockEntryOwnership
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

/**
 * The entry owner read off the **call-activity declarers** of the migrating version's tree — the same
 * walk, and therefore the same answer, the plan-level suggesters and the executors use.
 *
 * Matched on the block's full id first and on its **key** second. An entry may legitimately name a
 * version the tree does not have: a `removeBuildingBlock` entry names the version the instances are on,
 * which after a version bump is not the one the model declares, and an author is free to type one that
 * was never declared at all. The key still identifies which hop of the tree the entry is about, and the
 * hop is what decides the owner; where even the key is unknown the migrating blueprint is the honest
 * answer, since that is the document the executor falls back to for a block hanging directly off it.
 */
class CallActivityBuildingBlockEntryOwnership(
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
) : BuildingBlockEntryOwnership {

    /** A case definition and a building block both declare blocks, so this answers for either. */
    override fun supports(blueprintType: BlueprintType): Boolean = true

    override fun entryOwnerOf(migratingOwner: BlueprintId, block: BuildingBlockDefinitionId): BlueprintId {
        val declarers = linkedBuildingBlockVersionResolver.resolveCallActivityDeclarers(migratingOwner)
        val declaredBy = declarers[block]
            ?: declarers.entries.firstOrNull { (declared, _) -> declared.key == block.key }?.value
        return declaredBy ?: migratingOwner
    }
}
