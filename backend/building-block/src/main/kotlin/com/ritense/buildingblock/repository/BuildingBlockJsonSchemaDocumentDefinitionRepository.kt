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


import com.ritense.buildingblock.domain.impl.BuildingBlockJsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.BuildingBlockJsonSchemaDocumentDefinition
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface BuildingBlockJsonSchemaDocumentDefinitionRepository :
    org.springframework.data.jpa.repository.JpaRepository<
        BuildingBlockJsonSchemaDocumentDefinition,
        BuildingBlockJsonSchemaDocumentDefinitionId
        > {

    @Query(
        """
        SELECT definition.id.buildingBlockDefinitionId
        FROM BuildingBlockJsonSchemaDocumentDefinition definition
        WHERE definition.id.documentDefinitionName = :documentDefinitionName
        ORDER BY definition.id.buildingBlockDefinitionId.key,
                 definition.id.buildingBlockDefinitionId.versionTag DESC
        """
    )
    fun findVersionsByName(
        @Param("documentDefinitionName") documentDefinitionName: String
    ): List<BuildingBlockDefinitionId>
}