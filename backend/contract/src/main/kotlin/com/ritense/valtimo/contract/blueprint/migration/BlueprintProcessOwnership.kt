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

/** Which processes belong to the blueprints this one reaches rather than to itself — what tells a relocated process from a lost one, and so whether a suggestion owes the author an explanation. */
interface BlueprintProcessOwnership {

    /** Whether this implementation can answer for owners of the given type. */
    fun supports(blueprintType: BlueprintType): Boolean

    /** The process keys owned by the blueprints [blueprintId] reaches through its building blocks, transitively. Its own processes are deliberately not included. */
    fun processesOfReachableBlueprints(blueprintId: BlueprintId): Set<String>
}
