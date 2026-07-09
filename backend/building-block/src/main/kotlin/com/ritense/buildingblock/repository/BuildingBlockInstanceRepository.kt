/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.repository

import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Slice
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface BuildingBlockInstanceRepository :
    JpaRepository<BuildingBlockInstance, UUID> {
    fun findByDocumentId(documentId: UUID): BuildingBlockInstance?
    fun findByProcessInstanceId(processInstanceId: String): BuildingBlockInstance?
    fun findAllByCaseDocumentId(caseDocumentId: UUID): List<BuildingBlockInstance>

    /**
     * The (BB-own) document ids of every instance of a specific building block definition version
     * (key + version), paged in a stable order. Used by the migration engine to enumerate the
     * instances a building block migration plan should consider; the plan's conditions do the
     * further filtering.
     */
    @Query(
        "SELECT b.documentId FROM BuildingBlockInstance b " +
            "WHERE b.definition.id = :definitionId ORDER BY b.documentId"
    )
    fun findDocumentIdsByDefinitionId(
        @Param("definitionId") definitionId: BuildingBlockDefinitionId,
        pageable: Pageable,
    ): Slice<UUID>
}
