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

/**
 * Answers "which version was this blueprint version derived from?", for one kind of
 * [blueprint][BlueprintType].
 *
 * A migration plan is deployed under its *target* version and migrates instances of the version that
 * target was based on, so the source version is never written in the plan — it is read back from the
 * blueprint here. The migration engine lives in the `case` module and cannot reach the runtime of
 * every blueprint type (it must not depend on `building-block`, for one), so each owning module
 * contributes an implementation as a Spring bean and the engine picks the one that [supports] the
 * type it is looking at.
 *
 * Deliberately separate from [MigrationCandidateProvider]. Lineage is needed for **every** blueprint
 * type — a building block plan still has to render "1.0.3 → 1.0.4" and still has to know its own
 * source version — whereas enumerating instances to run a plan over is only meaningful for a
 * blueprint type whose plans can be started on their own, which building blocks cannot be. Keeping
 * them apart is what stops a building-block implementation of "find every instance of this version"
 * existing at all; see [MigrationCandidateProvider].
 */
interface BlueprintVersionLineage {

    /** Whether this implementation resolves lineage for the given [blueprintType]. */
    fun supports(blueprintType: BlueprintType): Boolean

    /**
     * The version the given (target) blueprint was based on — the *source* version a plan deployed
     * on it migrates from. Null when unknown (no predecessor, or the blueprint does not exist).
     */
    fun basedOnVersionTag(blueprintId: BlueprintId): Semver?
}
