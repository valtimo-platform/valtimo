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
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Slice
import java.util.UUID

/** Enumerates the instances a plan runs over, for one [BlueprintType]. Implement only where plans can be started standalone — there is deliberately no building-block implementation, so the compiler enforces R1. */
interface MigrationCandidateProvider {

    /** Whether this provider enumerates candidates for the given [blueprintType]. */
    fun supports(blueprintType: BlueprintType): Boolean

    /** A page of candidate instance ids homed on the given source version, in a stable order so paging is repeatable across a run. */
    fun findCandidateIds(source: BlueprintId, pageable: Pageable): Slice<UUID>
}
