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

/** Checks that every `removeBuildingBlock` entry names the version it dissolves. Reads raw JSON: parsing an entry without one fails inside Jackson, which reaches the editor as a 500 rather than a 400 (D7). */
class RemoveBuildingBlockVersionChecker {

    /** Descriptions of every entry in [component] that names no version; empty when they all do. */
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

    /** @throws IllegalArgumentException when any entry names no version — the save path rethrows exactly that as a 400 (D7). */
    fun assertVersioned(component: JsonNode) {
        val problems = findVersionless(component)
        require(problems.isEmpty()) { "Migration plan cannot be deployed: ${problems.joinToString("; and ")}" }
    }

    private companion object {
        const val BUILDING_BLOCK_KEY_FIELD = "buildingBlockKey"
        const val BUILDING_BLOCK_VERSION_TAG_FIELD = "buildingBlockVersionTag"
    }
}
