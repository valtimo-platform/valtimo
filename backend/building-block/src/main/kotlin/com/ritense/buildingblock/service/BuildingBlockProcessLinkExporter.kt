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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessLinkService
import org.operaton.bpm.engine.RepositoryService
import java.io.ByteArrayOutputStream

class BuildingBlockProcessLinkExporter(
    private val processLinkService: ProcessLinkService,
    private val objectMapper: ObjectMapper,
    private val repositoryService: RepositoryService,
    private val processLinkMappers: List<ProcessLinkMapper>,
) : Exporter<BuildingBlockProcessDefinitionExportRequest> {

    override fun supports() = BuildingBlockProcessDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockProcessDefinitionExportRequest): ExportResult {
        val processDefinitionId = request.processDefinitionId

        val processDefinitionKey = requireNotNull(
            repositoryService.createProcessDefinitionQuery()
                .processDefinitionId(processDefinitionId)
                .singleResult()
        ).key

        val exportDtos = processLinkService.getProcessLinks(processDefinitionId).map { link ->
            getProcessLinkMapper(link.processLinkType).toProcessLinkExportResponseDto(link)
        }

        if (exportDtos.isEmpty()) {
            return ExportResult(null)
        }

        val bytes = ByteArrayOutputStream().use {
            objectMapper.writeValue(it, exportDtos)
            it.toByteArray()
        }

        val formattedVersion = request.buildingBlockDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val file = ExportFile(
            PATH.format(
                request.buildingBlockDefinitionId.key,
                formattedVersion,
                processDefinitionKey
            ),
            bytes
        )

        return ExportResult(file)
    }

    private fun getProcessLinkMapper(processLinkType: String): ProcessLinkMapper {
        return processLinkMappers.singleOrNull { it.supportsProcessLinkType(processLinkType) }
            ?: throw IllegalStateException("No ProcessLinkMapper found for processLinkType $processLinkType")
    }

    companion object {
        private const val PATH =
            "config/building-block/%s/%s/process-link/%s.process-link.json"
    }
}