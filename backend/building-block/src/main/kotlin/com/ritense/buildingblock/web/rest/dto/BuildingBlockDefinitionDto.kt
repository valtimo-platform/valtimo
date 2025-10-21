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