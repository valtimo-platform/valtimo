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

package com.ritense.buildingblock.domain.impl

import com.ritense.document.domain.DocumentDefinition
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.domain.AbstractId
import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.Embedded

@Embeddable
class BuildingBlockJsonSchemaDocumentDefinitionId() :
    AbstractId<BuildingBlockJsonSchemaDocumentDefinitionId>(),
    DocumentDefinition.Id {

    @Column(
        name = "document_definition_name",
        length = 50,
        nullable = false,
        updatable = true,
        columnDefinition = "VARCHAR(50)"
    )
    lateinit var documentDefinitionName: String

    @Embedded
    lateinit var buildingBlockDefinitionId: BuildingBlockDefinitionId

    constructor(
        name: String,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ) : this() {
        require(name.isNotBlank()) { "name is required" }
        require(name.length in 1..50) { "name must be between 1-50 characters" }
        require(name.matches(Regex("[A-Za-z0-9-_.]+"))) {
            "name contains illegal character. For name: $name"
        }
        this.documentDefinitionName = name
        this.buildingBlockDefinitionId = buildingBlockDefinitionId
    }

    override fun name(): String = documentDefinitionName
    override fun buildingBlockDefinitionId(): BuildingBlockDefinitionId = buildingBlockDefinitionId

    override fun toString(): String = "$documentDefinitionName:$buildingBlockDefinitionId"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is BuildingBlockJsonSchemaDocumentDefinitionId) return false
        return documentDefinitionName == other.documentDefinitionName &&
            buildingBlockDefinitionId == other.buildingBlockDefinitionId
    }

    override fun hashCode(): Int =
        31 * documentDefinitionName.hashCode() + buildingBlockDefinitionId.hashCode()
}