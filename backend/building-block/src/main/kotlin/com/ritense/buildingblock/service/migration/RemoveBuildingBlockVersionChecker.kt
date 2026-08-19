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

package com.ritense.buildingblock.service.migration

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockInstruction

/**
 * Checks that every `removeBuildingBlock` entry names the **version** it dissolves, which
 * [RemoveBuildingBlockInstruction] requires.
 *
 * Reads the raw JSON rather than the parsed instructions on purpose: with the field required, parsing an
 * entry that omits it fails inside Jackson, and a `MissingKotlinParameterException` reaching the plan
 * editor is a 500 that says the server broke rather than a 400 that says which entry is wrong — the same
 * trap D7 records for the importer's own refusals.
 *
 * Used at both points where a plan can still be corrected: the management save path (via
 * [RemoveBuildingBlockMigrationComponentValidator], a 400 like every other validator) and
 * [RemoveBuildingBlockMigrationComponentDeployer], which is what catches a plan deployed from a **file**
 * — those never pass the save path.
 */
class RemoveBuildingBlockVersionChecker {

    /**
     * Descriptions of every entry in [component] that names no version; empty when they all do.
     * [component] is the plan's `removeBuildingBlock` array.
     */
    fun findVersionless(component: JsonNode): List<String> {
        return component.mapIndexedNotNull { index, entry ->
            val version = entry.get(BUILDING_BLOCK_VERSION_TAG_FIELD)?.asText()
            if (!version.isNullOrBlank()) {
                return@mapIndexedNotNull null
            }
            val key = entry.get(BUILDING_BLOCK_KEY_FIELD)?.asText()?.takeUnless { it.isBlank() } ?: "(no key)"
            "its 'removeBuildingBlock' entry ${index + 1} for building block '$key' names no " +
                "'$BUILDING_BLOCK_VERSION_TAG_FIELD'. An entry dissolves one version: its dataMigration " +
                "reads that version's document schema and its processMigration names that version's " +
                "process definitions. Name the version the instances are on — one entry per version when " +
                "more than one is live."
        }
    }

    /**
     * @throws IllegalArgumentException when any entry in [component] names no version. An
     * `IllegalArgumentException` on purpose: the management save path rethrows exactly that as a 400
     * (D7), and on the file-import path an exception is the right outcome.
     */
    fun assertVersioned(component: JsonNode) {
        val problems = findVersionless(component)
        require(problems.isEmpty()) { "Migration plan cannot be deployed: ${problems.joinToString("; and ")}" }
    }

    private companion object {
        const val BUILDING_BLOCK_KEY_FIELD = "buildingBlockKey"
        const val BUILDING_BLOCK_VERSION_TAG_FIELD = "buildingBlockVersionTag"
    }
}
