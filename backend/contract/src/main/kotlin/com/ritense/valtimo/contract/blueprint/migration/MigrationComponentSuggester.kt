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

/** Lets a module produce a best-effort suggestion for its component of a plan, so the UI can pre-fill a new one. Advisory — the user edits before saving. */
interface MigrationComponentSuggester {

    /** The plan component this suggester fills; matches [MigrationComponentDeployer.componentKey]. */
    fun componentKey(): String

    /** A best-effort suggestion for migrating [source] to [target], or null when there is nothing to suggest. */
    fun suggest(source: BlueprintId, target: BlueprintId): Any?

    /** The same component suggested for one add/removeBuildingBlock entry, where [source] and [target] are a block and its owner. Asked rather than derived: a nested entry and a cross-key block plan look identical. */
    fun suggestForBuildingBlockEntry(source: BlueprintId, target: BlueprintId): Any? = suggest(source, target)
}
