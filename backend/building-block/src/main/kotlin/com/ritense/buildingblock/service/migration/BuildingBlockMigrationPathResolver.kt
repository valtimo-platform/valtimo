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

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver
import org.springframework.data.repository.findByIdOrNull

/**
 * Works out the versions a building block instance has to travel through to get from the version it
 * is on to the version its owner now links.
 *
 * A case definition may jump several building block versions at once (linking `3.0.0` where the
 * instance is still on `1.0.0`), so the upgrade is not one hop but a chain. The chain is reconstructed
 * from each definition's [com.ritense.buildingblock.domain.definition.BuildingBlockDefinition.basedOnVersionTag]
 * — the same "what was this version derived from" link the engine already uses to work out a single
 * plan's source version — walked **backwards** from the target until the instance's current version is
 * reached, then reversed.
 */
class BuildingBlockMigrationPathResolver(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
) {

    /**
     * The versions to migrate through to get from [current] to [target], in ascending order and
     * excluding [current] itself. `1.0.0 → 3.0.0` over a linear chain yields `[2.0.0, 3.0.0]`.
     *
     * Returns an empty list when [target] is not newer than [current] (the caller decides whether that
     * is a no-op or a refusal to downgrade).
     *
     * @throws IllegalStateException when no path exists — the chain runs out of `basedOnVersionTag`
     * before reaching [current], revisits a version, or is implausibly long. A building block that was
     * created independently rather than as a new version of its predecessor has no path, and silently
     * skipping such an instance would leave it stranded on an unsupported version.
     */
    fun resolvePath(key: String, current: Semver, target: Semver): List<Semver> {
        if (!target.isGreaterThan(current)) {
            return emptyList()
        }

        val descending = mutableListOf<Semver>()
        val seen = mutableSetOf<Semver>()
        var version: Semver = target

        while (version != current) {
            if (!seen.add(version)) {
                throw IllegalStateException(
                    "Cannot migrate building block '$key' from '$current' to '$target': " +
                        "the version chain loops at '$version'"
                )
            }
            if (descending.size > MAX_CHAIN_LENGTH) {
                throw IllegalStateException(
                    "Cannot migrate building block '$key' from '$current' to '$target': " +
                        "the version chain is longer than $MAX_CHAIN_LENGTH steps"
                )
            }
            descending += version

            val definition = buildingBlockDefinitionRepository.findByIdOrNull(BuildingBlockDefinitionId(key, version))
                ?: throw IllegalStateException(
                    "Cannot migrate building block '$key' from '$current' to '$target': " +
                        "no definition deployed for version '$version'"
                )
            version = definition.basedOnVersionTag
                ?: throw IllegalStateException(
                    "Cannot migrate building block '$key' from '$current' to '$target': " +
                        "version '$version' is not based on a previous version, so there is no upgrade path"
                )
        }

        return descending.reversed()
    }

    private companion object {
        const val MAX_CHAIN_LENGTH = 100
    }
}
