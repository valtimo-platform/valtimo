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
}
