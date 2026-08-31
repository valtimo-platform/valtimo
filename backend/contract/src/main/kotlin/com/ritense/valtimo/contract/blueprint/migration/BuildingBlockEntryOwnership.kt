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

/** Whose document and processes an add/removeBuildingBlock entry exchanges state with — the parent block for a nested one, since the executors resolve the owner from the running tree. */
interface BuildingBlockEntryOwnership {

    /** Whether this implementation can answer for migrating blueprints of the given type. */
    fun supports(blueprintType: BlueprintType): Boolean

    /** The blueprint an entry for [block] exchanges state with, read against [migratingOwner] — the plan's target for an add, its source for a remove. [migratingOwner] itself when it declares [block] directly. */
    fun entryOwnerOf(migratingOwner: BlueprintId, block: BuildingBlockDefinitionId): BlueprintId
}
