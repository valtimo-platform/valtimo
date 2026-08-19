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

package com.ritense.buildingblock.domain.migration

import com.fasterxml.jackson.annotation.JsonInclude
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction

/**
 * A single `removeBuildingBlock` entry from a migration plan: dissolve the building block(s) of
 * [buildingBlockKey] **anywhere below** the instance being migrated, at any depth, deepest first.
 *
 * Nothing is destroyed until its state has been transferred back to its owner: [processMigration]
 * hands the building block's process(es) back (business key set back to the owner document id), and
 * [dataMigration] copies data back (each patch's `source` is read against the building block document,
 * its `target` is written into the owner document). Only then is the building block's JSON document
 * deleted. For a nested block the owner is its **parent block**, not the case that happens to be
 * migrating, so its state goes back one level rather than skipping to the top.
 *
 * [buildingBlockVersionTag] is **required**, exactly as [AddBuildingBlockInstruction]'s is. An entry's
 * `dataMigration` reads paths out of the block's document schema and its `processMigration` names keys
 * out of the block's BPMN, and both are properties of one *version* — so an entry that took "whichever
 * version is here" was configured against a schema it might not meet. Naming the version makes the plan
 * state what it acts on, which is also what lets the executor recognise a block it was *not* told about
 * instead of quietly walking past it (see [RemoveBuildingBlockMigrationComponentExecutor]).
 *
 * A fleet mid-chain, with two versions of one block live at once, therefore needs one entry per version.
 * That is the point: each carries the data and process mapping its own version needs.
 *
 * It nevertheless **defaults to blank**, and that is not a way in. Every path that stores an entry refuses
 * a blank one first — the management save path with a 400 and
 * [RemoveBuildingBlockMigrationComponentDeployer] with an exception, both through
 * [RemoveBuildingBlockVersionChecker], which reads the raw JSON *before* this class is constructed. So the
 * default can only ever come from a row **already stored** when the field became required, and it exists
 * precisely so such a row can still be read.
 *
 * That reading is the repair. The version cannot be derived — nothing knows which version an entry meant,
 * only its author does — so the repair is to open the plan and save it again, and refusing to deserialise
 * was what made that impossible: the plan's own detail endpoint (which exports its components) failed, so
 * the one plan that needed editing was the one that could not be opened. A blank version is instead carried
 * out to the editor, where the field is required, and refused by
 * [RemoveBuildingBlockMigrationComponentExecutor] until it is filled in — never acted on. G29.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class RemoveBuildingBlockInstruction(
    val buildingBlockKey: String,
    val buildingBlockVersionTag: String = "",
    val dataMigration: List<DataMigrationPatch> = emptyList(),
    val processMigration: List<ProcessMigrationInstruction> = emptyList(),
)
