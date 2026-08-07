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

/**
 * Enumerates the instances a migration plan should be run over, for one kind of
 * [blueprint][BlueprintType].
 *
 * Implement this **only for a blueprint type whose plans can be started on their own**. Enumerating
 * "every instance of version X" is precisely how a plan run selects its work, so an implementation is
 * a licence to run that type standalone.
 *
 * That rules building blocks out. A building block has no lifecycle of its own — it exists inside a
 * case — so it migrates because its *owner* migrated, and only onto the version the owner's new
 * version links. A global scan over every instance of a building-block version would migrate blocks
 * under cases that have not migrated and may never migrate. There is deliberately no building-block
 * implementation of this interface: the `building-block` module contributes only
 * [BlueprintVersionLineage], so the omission is enforced by the compiler rather than by everyone
 * remembering to guard their call sites.
 *
 * The source version a plan migrates from comes from [BlueprintVersionLineage], which every type
 * implements.
 *
 * The returned [UUID] is the document/instance id handed to each
 * [MigrationComponentExecutor.execute] as `caseId`.
 */
interface MigrationCandidateProvider {

    /** Whether this provider enumerates candidates for the given [blueprintType]. */
    fun supports(blueprintType: BlueprintType): Boolean

    /**
     * A page of candidate instance (document) ids homed on the given *source* blueprint version, in a
     * stable order so paging is repeatable across a run.
     */
    fun findCandidateIds(source: BlueprintId, pageable: Pageable): Slice<UUID>
}
