/*
 *
 *  * Copyright 2015-2026 Ritense BV, the Netherlands.
 *  *
 *  * Licensed under EUPL, Version 1.2 (the "License");
 *  * you may not use this file except in compliance with the License.
 *  * You may obtain a copy of the License at
 *  *
 *  * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *  *
 *  * Unless required by applicable law or agreed to in writing, software
 *  * distributed under the License is distributed on an "AS IS" basis,
 *  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  * See the License for the specific language governing permissions and
 *  * limitations under the License.
 *
 */

package com.ritense.buildingblock.service

import com.ritense.buildingblock.processlink.dto.BuildingBlockProcessLinkExportResponseDto
import com.ritense.exporter.request.BuildingBlockDefinitionExportRequest
import com.ritense.exporter.request.ExportRequest
import com.ritense.processlink.exporter.BuildingBlockProcessLinkToBuildingBlockMapper
import com.ritense.processlink.web.rest.dto.ProcessLinkExportResponseDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId

class BuildingBlockProcessLinkToBuildingBlockMapper: BuildingBlockProcessLinkToBuildingBlockMapper {
    override fun toBuildingBlockExportRequests(processLinkDtos: List<ProcessLinkExportResponseDto>): Set<ExportRequest> {
        return processLinkDtos.filterIsInstance<BuildingBlockProcessLinkExportResponseDto>().map {
            it.buildingBlockDefinitionKey to it.buildingBlockDefinitionVersionTag
        }.groupBy(
            {it.first}, {it.second}
        ).mapValues {
            it.value.toSet()
        }.flatMap { bbEntry ->
            bbEntry.value.map {
                BuildingBlockDefinitionExportRequest(
                    BuildingBlockDefinitionId.of(bbEntry.key, it)
                )
            }
        }.toSet()
    }

}