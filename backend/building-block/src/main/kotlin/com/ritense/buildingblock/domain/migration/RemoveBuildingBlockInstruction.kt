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

/** A `removeBuildingBlock` entry: dissolve the block anywhere below the migrating instance, deepest first, transferring state back one level before deleting. The version tag is required; it defaults to blank only so a row stored before that can still be opened and repaired (G29). */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class RemoveBuildingBlockInstruction(
    val buildingBlockKey: String,
    val buildingBlockVersionTag: String = "",
    val dataMigration: List<DataMigrationPatch> = emptyList(),
    val processMigration: List<ProcessMigrationInstruction> = emptyList(),
)
