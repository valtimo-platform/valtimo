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
import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.data.repository.findByIdOrNull
import java.util.UUID

/** Points a building block instance at a definition version. A block is two records and a migration moves both: the engine owns the document half, this owns the instance half. */
class BuildingBlockInstanceRehomer(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
) {

    /** Re-point the instance owning [documentId] at [target], if it is not already there. */
    fun rehome(documentId: UUID, target: BuildingBlockDefinitionId) {
        val instance = buildingBlockInstanceRepository.findByDocumentId(documentId)
            ?: throw NoSuchElementException("No building block instance found for document '$documentId'")
        if (instance.definition.id == target) {
            return
        }
        instance.definition = buildingBlockDefinitionRepository.findByIdOrNull(target)
            ?: throw NoSuchElementException("No building block definition found for '$target'")
        buildingBlockInstanceRepository.save(instance)
    }
}
