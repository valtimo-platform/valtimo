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

package com.ritense.buildingblock.web.rest.dto

import com.ritense.buildingblock.domain.instance.BuildingBlockInstance
import java.util.UUID

data class BuildingBlockInstanceDto(
    val id: UUID,
    val documentId: UUID,
    val caseDocumentId: UUID?,
    val definitionKey: String,
    val definitionVersionTag: String,
    val activityId: String?,
    val callerProcessDefinitionId: String?,
    val processInstanceId: String?,
    val parentBuildingBlockInstanceId: UUID?,
    val rootBuildingBlockInstanceId: UUID?,
) {
    companion object {
        fun from(instance: BuildingBlockInstance): BuildingBlockInstanceDto =
            BuildingBlockInstanceDto(
                id = instance.id,
                documentId = instance.documentId,
                caseDocumentId = instance.caseDocumentId,
                definitionKey = instance.definition.id.key,
                definitionVersionTag = instance.definition.id.versionTag.toString(),
                activityId = instance.activityId,
                callerProcessDefinitionId = instance.callerProcessDefinitionId,
                processInstanceId = instance.processInstanceId,
                parentBuildingBlockInstanceId = instance.parentBuildingBlockInstanceId,
                rootBuildingBlockInstanceId = instance.rootBuildingBlockInstanceId,
            )
    }
}
