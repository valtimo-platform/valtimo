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
 * [buildingBlockKey] that are directly linked to the instance being migrated (its owner — a case,
 * or a parent building block).
 *
 * Nothing is destroyed until its state has been transferred back to the owner: [processMigration]
 * hands the building block's process(es) back to the owner (business key set back to the owner
 * document id), and [dataMigration] copies data back (each patch's `source` is read against the
 * building block document, its `target` is written into the owner document). Only then is the
 * building block's JSON document deleted.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class RemoveBuildingBlockInstruction(
    val buildingBlockKey: String,
    val dataMigration: List<DataMigrationPatch> = emptyList(),
    val processMigration: List<ProcessMigrationInstruction> = emptyList(),
)
