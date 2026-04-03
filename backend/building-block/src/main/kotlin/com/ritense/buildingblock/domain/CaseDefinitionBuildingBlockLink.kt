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

package com.ritense.buildingblock.domain

import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.Column
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.Type
import java.util.UUID

@Entity
@Table(name = "case_definition_building_block_link")
class CaseDefinitionBuildingBlockLink(
    @Id
    @Column(name = "id")
    val id: UUID = UUID.randomUUID(),

    @Embedded
    val caseDefinitionId: CaseDefinitionId,

    @Embedded
    val buildingBlockDefinitionId: BuildingBlockDefinitionId,

    @Type(value = JsonType::class)
    @Column(name = "input_mappings", columnDefinition = "json")
    var inputMappings: List<BuildingBlockInputMapping> = emptyList(),

    @Type(value = JsonType::class)
    @Column(name = "output_mappings", columnDefinition = "json")
    var outputMappings: List<BuildingBlockOutputMapping> = emptyList(),

    @Type(value = JsonType::class)
    @Column(name = "plugin_configuration_mappings", columnDefinition = "json")
    var pluginConfigurationMappings: Map<String, UUID> = emptyMap()
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || this::class != other::class) return false
        other as CaseDefinitionBuildingBlockLink
        return id == other.id
    }

    override fun hashCode(): Int = id.hashCode()

    override fun toString(): String {
        return "CaseDefinitionBuildingBlockLink(id=$id, caseDefinitionId=$caseDefinitionId, buildingBlockDefinitionId=$buildingBlockDefinitionId)"
    }
}
