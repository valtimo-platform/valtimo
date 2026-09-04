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
import io.github.oshai.kotlinlogging.KotlinLogging

/** The entry owner read off the call-activity declarers of the migrating version's tree. Matched on full id first, then key — an entry may legitimately name a version the tree does not have. */
class CallActivityBuildingBlockEntryOwnership(
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
) : BuildingBlockEntryOwnership {

    /** A case definition and a building block both declare blocks, so this answers for either. */
    override fun supports(blueprintType: BlueprintType): Boolean = true

    override fun entryOwnerOf(migratingOwner: BlueprintId, block: BuildingBlockDefinitionId): BlueprintId {
        val declarers = linkedBuildingBlockVersionResolver.resolveCallActivityDeclarers(migratingOwner)
        declarers[block]?.let { return it }

        val sameKey = declarers.entries.filter { (declared, _) -> declared.key == block.key }
        warnIfAmbiguous(migratingOwner, block.key, sameKey.map { it.key }, "which declares it")
        return sameKey.singleOrNull()?.value ?: migratingOwner
    }

    /** Only a block can sit at another version of itself; a case is named by the plan, which already says which version. */
    override fun ownerAsDeclaredIn(tree: BlueprintId, owner: BlueprintId): BlueprintId {
        if (owner !is BuildingBlockDefinitionId) {
            return owner
        }
        val declared = linkedBuildingBlockVersionResolver.resolveCallActivityReachable(tree)
        if (owner in declared) {
            return owner
        }

        val sameKey = declared.filter { it.key == owner.key }
        warnIfAmbiguous(tree, owner.key, sameKey, "where its instances still are")
        return sameKey.singleOrNull() ?: owner
    }

    /**
     * One version of a key is an answer; several is a guess. Which of them governs cannot be told from here,
     * and taking whichever the set or map happened to yield first made the answer depend on iteration order —
     * the same order-dependence D4 refuses where it decides a running block's fate. Both callers fall back to
     * the blueprint they were given, which is what they already do when the tree declares no version at all.
     */
    private fun warnIfAmbiguous(
        tree: BlueprintId,
        key: String,
        candidates: List<BuildingBlockDefinitionId>,
        question: String,
    ) {
        if (candidates.size <= 1) {
            return
        }
        logger.info {
            "'$tree' declares ${candidates.size} versions of building block '$key' (" +
                candidates.map { it.toString() }.sorted().joinToString { "'$it'" } +
                "), so none of them can be said to be $question. Falling back to the version asked about."
        }
    }

    private companion object {
        val logger = KotlinLogging.logger {}
    }
}
