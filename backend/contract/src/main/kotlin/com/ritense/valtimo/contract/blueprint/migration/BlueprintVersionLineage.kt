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

/** Answers "which version was this blueprint version derived from?" per [BlueprintType]. Only pre-fills a new plan's source and checks a declared one is deployed — a plan always declares its own. */
interface BlueprintVersionLineage {

    /** Whether this implementation resolves lineage for the given [blueprintType]. */
    fun supports(blueprintType: BlueprintType): Boolean

    /** The version the given blueprint was based on — a suggestion for a new plan's source, never the source itself. Null when unknown. */
    fun basedOnVersionTag(blueprintId: BlueprintId): Semver?

    /** Whether the given blueprint version is deployed — [basedOnVersionTag] cannot tell "no predecessor" from "does not exist". */
    fun exists(blueprintId: BlueprintId): Boolean

    /** Every deployed version of [blueprintId]'s key. Backs the fallback to the newest version below the target, for versions that record no predecessor. Defaults to none, leaving the fallback off. */
    fun deployedVersionTags(blueprintId: BlueprintId): List<Semver> = emptyList()
}
