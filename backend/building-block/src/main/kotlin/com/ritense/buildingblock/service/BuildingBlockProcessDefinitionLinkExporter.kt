/*
 *
 *  * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionDto
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.repository.ProcessDefinition
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayOutputStream
import java.util.stream.Collectors

@Transactional(readOnly = true)
class BuildingBlockProcessDefinitionLinkExporter(
    private val objectMapper: ObjectMapper,
    private val repositoryService: RepositoryService,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
) : Exporter<BuildingBlockDocumentDefinitionExportRequest> {
    override fun supports() = BuildingBlockDocumentDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockDocumentDefinitionExportRequest): ExportResult {
        val processDefinitionBuildingBlockDefinitions = processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(request.buildingBlockDefinitionId)

        var mainProcessDefinition: ProcessDefinition? = null

        val processDefinitionExportRequests = processDefinitionBuildingBlockDefinitions.stream().map {
            if (it.main) {
                mainProcessDefinition = repositoryService.getProcessDefinition(it.id.processDefinitionId.id)
            }
            BuildingBlockProcessDefinitionExportRequest(it.id.processDefinitionId.id, request.buildingBlockDefinitionId)
        }.collect(Collectors.toSet())

        if (mainProcessDefinition == null) {
            return ExportResult(null, processDefinitionExportRequests)
        }

        val formattedCaseDefinitionVersion = request.buildingBlockDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val exportFile = ByteArrayOutputStream().use {
            objectMapper.writer(ExportPrettyPrinter()).writeValue(
                it,
                BuildingBlockProcessDefinitionDto(
                    mainProcessDefinition.id,
                    mainProcessDefinition.key,
                    mainProcessDefinition.name,
                    mainProcessDefinition.versionTag,
                    main = true
                )
            )

            ExportFile(
                PATH.format(
                    request.buildingBlockDefinitionId.key,
                    formattedCaseDefinitionVersion
                ),
                it.toByteArray()
            )
        }

        return ExportResult(exportFile, processDefinitionExportRequests)

    }

    companion object {
        private const val PATH =
            "config/building-block/%s/%s/building-block/building-block-definition-main-process-definition.json"
    }
}