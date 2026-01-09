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

package com.ritense.buildingblock.domain.instance

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.JoinColumns
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.util.UUID

// When a process instance is created, and it's within the context of a building block instance, set the key to that
// Alternatively: Set to document instance ID, so it works the same way it works for cases.
@Entity
@Table(name = "building_block_instance")
open class BuildingBlockInstance(
    @Id
    @Column(name = "id")
    val id: UUID = UUID.randomUUID(),

    @Column(name = "building_block_document_id", nullable = false)
    val documentId: UUID,

    // TODO: if we only link to document IDs then this could be document id.
    //  This is easier for supporting nested building blocks in the future, but ideally we have
    //  case instance as well so we can use blueprint instance id instead.
    @Column(name = "case_document_id", nullable = false)
    val caseDocumentId: UUID,

    @Column(name = "activity_id", nullable = false)
    val activityId: String,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumns(
        JoinColumn(
            name = "building_block_definition_key",
            referencedColumnName = "building_block_definition_key",
            nullable = false
        ),
        JoinColumn(
            name = "building_block_definition_version_tag",
            referencedColumnName = "building_block_definition_version_tag",
            nullable = false
        )
    )
    open var definition: BuildingBlockDefinition
) {

}
