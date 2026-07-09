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
import org.semver4j.Semver
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Slice
import java.util.UUID

/**
 * Enumerates the candidate instances (document ids) a migration plan should consider, for one
 * kind of [blueprint][BlueprintType].
 *
 * A plan targets a blueprint version but migrates the instances of a *source* version (by default
 * the version the target was based on — see [basedOnVersionTag]). The migration engine lives in the
 * `case` module and cannot reach the runtime of every blueprint type (e.g. it must not depend on
 * `building-block`). Each owning module therefore contributes a provider as a Spring bean; the
 * engine selects the one that [supports] the resolved source blueprint type and pages through its
 * candidate ids.
 *
 * The returned [UUID] is the case/document instance id passed to each
 * [MigrationComponentExecutor.execute] as `caseId`.
 */
interface MigrationCandidateProvider {

    /** Whether this provider enumerates candidates for the given [blueprintType]. */
    fun supports(blueprintType: BlueprintType): Boolean

    /**
     * The version the given (target) blueprint was based on — used as the default *source* version
     * a plan migrates from when the plan does not specify one explicitly. Null when unknown (e.g.
     * the blueprint has no predecessor or does not exist).
     */
    fun basedOnVersionTag(blueprintId: BlueprintId): Semver?

    /**
     * A page of candidate instance (document) ids for the given *source* blueprint version, in a
     * stable order so paging is repeatable across a run.
     */
    fun findCandidateIds(source: BlueprintId, pageable: Pageable): Slice<UUID>
}
