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

package com.ritense.valtimo.contract.blueprint.migration

import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

/**
 * Answers "whose document and processes does an `addBuildingBlock` / `removeBuildingBlock` entry for
 * this block exchange state with?".
 *
 * For a block the migrating blueprint declares itself that is the blueprint being migrated, and the
 * question is not worth asking. For a **nested** block it is the block above it: the executors resolve
 * the owner from the *running tree*, so a nested block is filled from, and handed back to, its parent
 * block's document and its parent block's processes — never the case's.
 *
 * It has to be asked because three places answer it and they disagreed. The plan-level suggesters walk
 * the link graph and get it right; the per-entry suggestion endpoint behind the editor's building-block
 * tab, and the editor's own value-path and process pickers, both assumed the migrating case. On
 * `woninginspectie:1.0.5` that showed as a suggested patch targeting `doc:/aanvragerNaam` — a field of
 * the parent block, and one the case's own picker cannot offer — beside a re-suggestion of the same
 * entry naming the *case's* process, which the executor then refuses with *"No process definition
 * 'woninginspectie' found for owner 'verhuizing-inspectie:1.0.5'"*.
 *
 * Lives in the contract for the same reason as [BlueprintProcessOwnership]: the walk is in the
 * `building-block` module, which the migration engine and the case module must not depend on.
 */
interface BuildingBlockEntryOwnership {

    /** Whether this implementation can answer for migrating blueprints of the given type. */
    fun supports(blueprintType: BlueprintType): Boolean

    /**
     * The blueprint version an entry for [block] exchanges data and processes with, given that
     * [migratingOwner] is the version whose tree the entry is read against — the plan's **target** for
     * an `addBuildingBlock` entry, its **source** for a `removeBuildingBlock` one, since that is the
     * version that still models the block being dissolved.
     *
     * Returns [migratingOwner] itself when it declares [block] directly, when nothing declares it, and
     * for a startable-item link, which nests nothing.
     */
    fun entryOwnerOf(migratingOwner: BlueprintId, block: BuildingBlockDefinitionId): BlueprintId
}
