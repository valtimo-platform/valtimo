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

import com.ritense.processdocument.migration.ProcessDefinitionBlueprintResolver
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintProcessOwnership

/**
 * The processes an owner reaches through its building blocks, for any owner type — a case definition
 * version or a building block version, since a block declares blocks of its own.
 *
 * Reuses the two pieces this module already has: [LinkedBuildingBlockVersionResolver] for the
 * transitive call-activity closure — the same walk `addBuildingBlock` is suggested from, so the answer
 * is by construction the set of blocks a plan may authorise — and the building-block
 * [ProcessDefinitionBlueprintResolver] for what each of those blocks deploys.
 *
 * Startable-item links are deliberately not walked. Nothing adopts a startable item, so a process
 * behind one is not relocated by a migration and is not accounted for by any entry the suggester
 * writes; treating it as explained would hide exactly the hole this interface exists to reveal.
 */
class BuildingBlockProcessOwnership(
    private val linkedBuildingBlockVersionResolver: LinkedBuildingBlockVersionResolver,
    private val buildingBlockProcessDefinitionResolver: ProcessDefinitionBlueprintResolver,
) : BlueprintProcessOwnership {

    /** Any owner may declare building blocks, so this answers for every blueprint type. */
    override fun supports(blueprintType: BlueprintType): Boolean = true

    override fun processesOfReachableBlueprints(blueprintId: BlueprintId): Set<String> =
        linkedBuildingBlockVersionResolver
            .resolveCallActivityReachable(blueprintId)
            .flatMapTo(mutableSetOf()) { block ->
                buildingBlockProcessDefinitionResolver.resolveProcessDefinitions(block).keys
            }
}
