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

import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import java.util.UUID

/**
 * Finds the building blocks a migrating instance owns.
 *
 * A migration only ever knows the document id it is migrating, which may be a case or a building
 * block, and the two are stored differently: a case's blocks are found by `caseDocumentId`, a block's
 * by `parentBuildingBlockInstanceId`. Nested blocks carry the `caseDocumentId` of the case they
 * ultimately belong to as well, so a case's *direct* blocks are only those without a parent.
 */
class BuildingBlockOwnershipResolver(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
) {

    /** The building blocks owned directly by [ownerDocumentId], whichever kind of owner it is. */
    fun directChildrenOf(ownerDocumentId: UUID): List<BuildingBlockInstance> {
        val owner = buildingBlockInstanceRepository.findByDocumentId(ownerDocumentId)
        return if (owner != null) {
            buildingBlockInstanceRepository.findAllByParentBuildingBlockInstanceId(owner.id)
        } else {
            buildingBlockInstanceRepository.findAllByCaseDocumentIdAndParentBuildingBlockInstanceIdIsNull(
                ownerDocumentId
            )
        }
    }

    /**
     * Every building block below [ownerDocumentId], to any depth, **deepest first**.
     *
     * The order is the point. Dissolving a block deletes one row (G25) and hands its process back to
     * *its own* owner, so a parent taken out before its children leaves them pointing at a deleted
     * instance and a document that no longer exists. Deepest-first makes each dissolve see a tree that is
     * still whole beneath it, and it is a property of the traversal rather than something each caller has
     * to remember.
     *
     * Each entry carries the instance's real owner, which is what a nested block's state must be handed
     * back to — the parent block, not the case that happens to be migrating.
     */
    fun subtreeOf(ownerDocumentId: UUID): List<OwnedBuildingBlock> {
        val byDepth = mutableListOf<List<OwnedBuildingBlock>>()
        var level = directChildrenOf(ownerDocumentId).map { OwnedBuildingBlock(it, parent = null, depth = 0) }
        var depth = 0
        while (level.isNotEmpty()) {
            byDepth += level
            if (++depth > MAX_DEPTH) {
                // Self-inflicted only: parent pointers are ours to set. Stop rather than loop forever,
                // and say so, because the caller is about to delete things based on this answer.
                logger.warn {
                    "Stopped walking building blocks below '$ownerDocumentId' at depth $MAX_DEPTH; the " +
                        "parent pointers are either cyclic or deeper than any blueprint should be. " +
                        "Anything below that depth is left alone."
                }
                break
            }
            val nextDepth = depth
            level = level.flatMap { owned ->
                buildingBlockInstanceRepository.findAllByParentBuildingBlockInstanceId(owned.instance.id)
                    .map { OwnedBuildingBlock(it, parent = owned.instance, depth = nextDepth) }
            }
        }
        return byDepth.reversed().flatten()
    }

    /** A building block below the migrating instance, with the instance that actually owns it. */
    data class OwnedBuildingBlock(
        val instance: BuildingBlockInstance,
        /** Null when [instance] hangs directly off the migrating owner. */
        val parent: BuildingBlockInstance?,
        val depth: Int,
    )

    private companion object {
        /** Matches `BuildingBlockAdoptionExecutor`'s cap: the trees are the same trees. */
        const val MAX_DEPTH = 20
        val logger = KotlinLogging.logger {}
    }
}
