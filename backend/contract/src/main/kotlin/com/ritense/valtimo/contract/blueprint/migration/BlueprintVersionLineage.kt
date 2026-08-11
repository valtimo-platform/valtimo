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
 * This is **not** where a migration plan's source comes from: a plan declares its own source, which is
 * what lets it span several versions or name a different key. Lineage answers a narrower question, for
 * the admin UI — "which version would an author most likely want to migrate from?", to pre-fill a new
 * plan's source with the target's predecessor — and "is this version deployed at all?", to reject a
 * plan naming a source nobody deployed. The migration engine lives in the `case` module and cannot
 * reach the runtime of every blueprint type (it must not depend on `building-block`, for one), so each
 * owning module contributes an implementation as a Spring bean and the engine picks the one that
 * [supports] the type it is looking at.
 *
 * Deliberately separate from [MigrationCandidateProvider]. Lineage is needed for **every** blueprint
 * type — a building block plan is authored in the same editor, and gets the same pre-filled source and
 * the same check on it — whereas enumerating instances to run a plan over is only meaningful for a
 * blueprint type whose plans can be started on their own, which building blocks cannot be. Keeping
 * them apart is what stops a building-block implementation of "find every instance of this version"
 * existing at all; see [MigrationCandidateProvider].
 */
interface BlueprintVersionLineage {

    /** Whether this implementation resolves lineage for the given [blueprintType]. */
    fun supports(blueprintType: BlueprintType): Boolean

    /**
     * The version the given blueprint was based on. This is only a *suggestion* for a new plan's
     * source — the predecessor is the source an author usually wants — never the source itself, which
     * a plan always declares for itself. Null when unknown (no predecessor, or the blueprint does not
     * exist).
     */
    fun basedOnVersionTag(blueprintId: BlueprintId): Semver?

    /**
     * Whether the given blueprint version is deployed.
     *
     * Needed because [basedOnVersionTag] returning null cannot tell "this version exists but has no
     * predecessor" apart from "this version does not exist", and a plan that names a source nobody
     * deployed selects no instances at all — a silence worth turning into an error when a plan is
     * saved.
     */
    fun exists(blueprintId: BlueprintId): Boolean
}
