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

package com.ritense.buildingblock.processlink.domain

import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink.Companion.PROCESS_LINK_TYPE
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink.Companion.SECONDARY_TABLE_NAME
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.ProcessLink
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import io.hypersistence.utils.hibernate.type.json.JsonType
import jakarta.persistence.AttributeOverride
import jakarta.persistence.AttributeOverrides
import jakarta.persistence.Column
import jakarta.persistence.DiscriminatorValue
import jakarta.persistence.Embedded
import jakarta.persistence.Entity
import jakarta.persistence.PrimaryKeyJoinColumn
import jakarta.persistence.SecondaryTable
import org.hibernate.annotations.Type
import java.util.UUID

@Entity
@SecondaryTable(
    name = SECONDARY_TABLE_NAME,
    pkJoinColumns = [PrimaryKeyJoinColumn(name = "process_link_id")]
)
@DiscriminatorValue(PROCESS_LINK_TYPE)
class BuildingBlockProcessLink(
    id: UUID,
    processDefinitionId: String,
    activityId: String,
    activityType: ActivityTypeWithEventName,

    @Embedded
    @AttributeOverrides(
        AttributeOverride(
            name = "key",
            column = Column(name = "building_block_definition_key", table = SECONDARY_TABLE_NAME)
        ),
        AttributeOverride(
            name = "versionTag",
            column = Column(name = "building_block_definition_version_tag", table = SECONDARY_TABLE_NAME)
        )
    )
    val buildingBlockDefinitionId: BuildingBlockDefinitionId,

    @Type(value = JsonType::class)
    @Column(
        name = "plugin_configuration_mappings",
        columnDefinition = "json",
        table = SECONDARY_TABLE_NAME
    )
    val pluginConfigurationMappings: Map<String, UUID>,

    @Type(value = JsonType::class)
    @Column(
        name = "input_mappings",
        columnDefinition = "json",
        table = SECONDARY_TABLE_NAME
    )
    val inputMappings: List<BuildingBlockInputMapping> = emptyList(),

    @Type(value = JsonType::class)
    @Column(
        name = "output_mappings",
        columnDefinition = "json",
        table = SECONDARY_TABLE_NAME
    )
    val outputMappings: List<BuildingBlockOutputMapping> = emptyList()

) : ProcessLink(
    id,
    processDefinitionId,
    activityId,
    activityType,
    PROCESS_LINK_TYPE,
) {

    override fun copy(id: UUID, processDefinitionId: String): ProcessLink = copy(
        id = id,
        processDefinitionId = processDefinitionId
    )

    fun copy(
        id: UUID = this.id,
        processDefinitionId: String = this.processDefinitionId,
        activityId: String = this.activityId,
        activityType: ActivityTypeWithEventName = this.activityType,
        buildingBlockDefinitionId: BuildingBlockDefinitionId = this.buildingBlockDefinitionId,
        pluginConfigurationMappings: Map<String, UUID> = this.pluginConfigurationMappings,
        inputMappings: List<BuildingBlockInputMapping> = this.inputMappings,
        outputMappings: List<BuildingBlockOutputMapping> = this.outputMappings,
    ): BuildingBlockProcessLink = BuildingBlockProcessLink(
        id = id,
        processDefinitionId = processDefinitionId,
        activityId = activityId,
        activityType = activityType,
        buildingBlockDefinitionId = buildingBlockDefinitionId,
        pluginConfigurationMappings = pluginConfigurationMappings,
        inputMappings = inputMappings,
        outputMappings = outputMappings
    )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        if (!super.equals(other)) return false

        other as BuildingBlockProcessLink

        if (buildingBlockDefinitionId != other.buildingBlockDefinitionId) return false
        if (pluginConfigurationMappings != other.pluginConfigurationMappings) return false
        if (inputMappings != other.inputMappings) return false
        if (outputMappings != other.outputMappings) return false

        return true
    }

    override fun hashCode(): Int {
        var result = super.hashCode()
        result = 31 * result + buildingBlockDefinitionId.hashCode()
        result = 31 * result + pluginConfigurationMappings.hashCode()
        result = 31 * result + inputMappings.hashCode()
        result = 31 * result + outputMappings.hashCode()
        return result
    }

    companion object {
        const val PROCESS_LINK_TYPE = "building-block"
        const val SECONDARY_TABLE_NAME = "building_block_process_link"
    }
}

data class BuildingBlockInputMapping(
    val source: String,
    val target: String
)

enum class BuildingBlockSyncTiming {
    CONTINUOUS,
    END
}

data class BuildingBlockOutputMapping(
    val source: String,
    val target: String,
    val syncTiming: BuildingBlockSyncTiming = BuildingBlockSyncTiming.END
)
