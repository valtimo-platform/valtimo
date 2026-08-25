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

/**
 * Lets a module produce a best-effort suggestion for its component of a migration plan, so the UI
 * can pre-fill a new plan when moving from a [source] blueprint version to a [target] version.
 *
 * The counterpart of [MigrationComponentDeployer] (which stores a component): where the deployer
 * persists a user-authored component, the suggester derives a sensible starting point (e.g. the
 * `processMigration` module maps equal BPMN activities, the `dataMigration` module proposes to keep
 * matching document fields). Suggestions are advisory only — the user edits them before saving.
 */
interface MigrationComponentSuggester {

    /**
     * The migration plan component this suggester fills, e.g. `"dataMigration"` or
     * `"processMigration"`. Matches the corresponding [MigrationComponentDeployer.componentKey].
     */
    fun componentKey(): String

    /**
     * A best-effort suggestion for this component when migrating from [source] to [target], as a
     * JSON-serializable value (the same shape the deployer accepts). Returns `null` when there is
     * nothing meaningful to suggest (or this suggester does not apply to the blueprint types).
     */
    fun suggest(source: BlueprintId, target: BlueprintId): Any?

    /**
     * The same component, suggested for one `addBuildingBlock` / `removeBuildingBlock` **entry** rather
     * than for a whole plan. [source] and [target] are then a building block and its owner (in whichever
     * direction the entry moves), not two versions of one thing.
     *
     * It is a genuinely different question, and both suggesters that override it answer differently: a
     * document path present on both sides is *free* between two versions of one document and is the whole
     * job when filling a block's own document, and a process pairing between two versions is a rename
     * where between an owner and its block it is a hijack of one running process.
     *
     * **Why it is asked rather than worked out.** The blueprint ids cannot answer it. A nested entry is
     * `block -> block`, and so is a cross-key building-block *plan* migrating a block onto its successor —
     * same two types, same two keys, opposite meanings. Only the caller knows which it wants.
     *
     * Defaults to [suggest], so a component contributed from outside these two keeps working and simply
     * makes no distinction.
     */
    fun suggestForBuildingBlockEntry(source: BlueprintId, target: BlueprintId): Any? = suggest(source, target)
}
