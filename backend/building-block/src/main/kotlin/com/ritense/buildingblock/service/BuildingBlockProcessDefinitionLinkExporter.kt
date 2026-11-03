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
import com.ritense.buildingblock.domain.BuildingBlockDefinitionMainProcessDefinitionDto
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import org.operaton.bpm.engine.RepositoryService
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayOutputStream

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

        val processDefinitionExportRequests =
            currentProcessDefinitionIds(processDefinitionBuildingBlockDefinitions.map { it.id.processDefinitionId.id })
                .mapTo(mutableSetOf()) {
                    BuildingBlockProcessDefinitionExportRequest(it, request.buildingBlockDefinitionId)
                }
        val mainProcessDefinition = processDefinitionBuildingBlockDefinitions
            .lastOrNull { it.main }
            ?.let { repositoryService.getProcessDefinition(it.id.processDefinitionId.id) }

        if (mainProcessDefinition == null) {
            return ExportResult(null, processDefinitionExportRequests)
        }

        val formattedCaseDefinitionVersion = request.buildingBlockDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val exportFile = ByteArrayOutputStream().use {
            objectMapper.writer(ExportPrettyPrinter()).writeValue(
                it,
                BuildingBlockDefinitionMainProcessDefinitionDto(
                    processDefinitionKey = mainProcessDefinition.key
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

    private fun currentProcessDefinitionIds(linkedProcessDefinitionIds: List<String>): Set<String> {
        if (linkedProcessDefinitionIds.isEmpty()) return emptySet()
        val linkedProcessDefinitions = repositoryService.createProcessDefinitionQuery()
            .processDefinitionIdIn(*linkedProcessDefinitionIds.toTypedArray())
            .list()
        val linkedKeys = linkedProcessDefinitions.mapTo(mutableSetOf()) { it.key }

        return linkedProcessDefinitions
            .groupBy { it.deploymentId }
            .values
            .filter { processDefinitions ->
                val fileKey = firstProcessKey(repositoryService.getBpmnModelInstance(processDefinitions.first().id))
                fileKey !in linkedKeys || processDefinitions.any { it.key == fileKey }
            }
            .flatten()
            .mapTo(mutableSetOf()) { it.id }
    }

    companion object {
        private const val PATH =
            "config/building-block/%s/%s/building-block/building-block-definition-main-process-definition.json"
    }
}
