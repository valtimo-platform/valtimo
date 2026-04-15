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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.web.rest.dto.CreateCaseDefinitionBuildingBlockLinkDto
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockDefinitionExportRequest
import com.ritense.exporter.request.CaseDefinitionBuildingBlockLinkExportRequest
import com.ritense.exporter.request.ExportRequest
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@SkipComponentScan
@Component
@Transactional(readOnly = true)
class CaseDefinitionBuildingBlockLinkExporter(
    private val objectMapper: ObjectMapper,
    private val linkRepository: CaseDefinitionBuildingBlockLinkRepository
) : Exporter<CaseDefinitionBuildingBlockLinkExportRequest> {

    override fun supports() = CaseDefinitionBuildingBlockLinkExportRequest::class.java

    override fun export(request: CaseDefinitionBuildingBlockLinkExportRequest): ExportResult {
        val links = linkRepository.findAllByCaseDefinitionId(request.caseDefinitionId)
        if (links.isEmpty()) return ExportResult()

        val caseDefinitionKey = request.caseDefinitionId.key
        val formattedVersion = request.caseDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val dtos = links.map {
            CreateCaseDefinitionBuildingBlockLinkDto(
                buildingBlockDefinitionKey = it.buildingBlockDefinitionId.key,
                buildingBlockDefinitionVersionTag = it.buildingBlockDefinitionId.versionTag.toString(),
                inputMappings = it.inputMappings,
                outputMappings = it.outputMappings,
                pluginConfigurationMappings = it.pluginConfigurationMappings
            )
        }

        val exportFile = ExportFile(
            PATH.format(caseDefinitionKey, formattedVersion, caseDefinitionKey),
            objectMapper
                .writer(ExportPrettyPrinter())
                .writeValueAsBytes(dtos)
        )

        val relatedRequests = mutableSetOf<ExportRequest>()
        links.forEach { link ->
            relatedRequests.add(
                BuildingBlockDefinitionExportRequest(link.buildingBlockDefinitionId)
            )
        }

        return ExportResult(exportFile, relatedRequests)
    }

    companion object {
        private const val PATH =
            "config/case/%s/%s/building-block-link/%s.case-building-block-links.json"
    }
}
