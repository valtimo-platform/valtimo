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

/**
 * Answers "which processes belong to the blueprints this one reaches, rather than to this one itself?"
 *
 * A blueprint version owns processes directly, and it *reaches* others through the building blocks it
 * declares — transitively, since a block may declare further blocks. The second set is what tells a
 * process that has been **relocated** apart from one that has been **lost**, and the difference decides
 * whether a migration plan owes the author an explanation:
 *
 * - A source process the target no longer owns **but a block it reaches does** has not gone anywhere.
 *   The plan adopts it with an `addBuildingBlock` entry, and a `processMigration` instruction for it
 *   would fight that entry. Nothing to say.
 * - A source process **nobody** accounts for is a genuine hole. Instances running it will be left
 *   where they are, silently, and only the author knows whether that is intended.
 *
 * Measured on `aanvraag-ioaw-uitkering-dcm`, that distinction is the difference between 89 unexplained
 * processes and 2: 87 of the 89 the target no longer owns belong to blocks it reaches.
 *
 * Separate from [ProcessDefinitionBlueprintResolver][com.ritense.processdocument.migration] deliberately.
 * That resolves the processes of *one* blueprint version and is the engine's building block for
 * migrating them; this walks the *link graph* and exists only to explain a suggestion. The walk lives in
 * the `building-block` module, which the migration engine must not depend on, so it arrives as a bean
 * like every other cross-module migration contract.
 */
interface BlueprintProcessOwnership {

    /** Whether this implementation can answer for owners of the given type. */
    fun supports(blueprintType: BlueprintType): Boolean

    /**
     * The process keys owned by the blueprint versions [blueprintId] reaches through its building
     * blocks, transitively. [blueprintId]'s own processes are **not** included — those are what a
     * resolver answers, and a caller distinguishing "mine" from "reachable" needs them kept apart.
     *
     * Empty when it reaches nothing, which is also the honest answer for a deployment with no building
     * blocks at all.
     */
    fun processesOfReachableBlueprints(blueprintId: BlueprintId): Set<String>
}
