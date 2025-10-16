package com.ritense.buildingblock.web.rest.dto

import com.fasterxml.jackson.annotation.JsonIgnore
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver
import java.time.LocalDateTime

data class BuildingBlockDefinitionDto(
    val key: String,
    val versionTag: String,
    val title: String,
    val description: String?,
    val createdBy: String?,
    val createdDate: LocalDateTime?,
    val basedOnVersionTag: String?,
    val final: Boolean
) {
    @JsonIgnore
    fun getBuildingBlockDefinitionId(): BuildingBlockDefinitionId =
        BuildingBlockDefinitionId(key, versionTag)

    fun toEntity(): BuildingBlockDefinition {
        return BuildingBlockDefinition(
            id = getBuildingBlockDefinitionId(),
            title = title,
            description = description,
            createdBy = createdBy,
            createdDate = createdDate,
            basedOnVersionTag = basedOnVersionTag?.let { Semver(it) },
            final = final
        )
    }
}