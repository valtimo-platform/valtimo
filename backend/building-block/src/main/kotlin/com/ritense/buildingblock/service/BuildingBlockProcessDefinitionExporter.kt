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

import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import java.io.ByteArrayOutputStream

class BuildingBlockProcessDefinitionExporter(
    private val operatonRepositoryService: OperatonRepositoryService,
    private val repositoryService: RepositoryService,
) : Exporter<BuildingBlockProcessDefinitionExportRequest> {
    override fun supports() = BuildingBlockProcessDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockProcessDefinitionExportRequest): ExportResult {
        val processDefinition = requireNotNull(
            operatonRepositoryService.findProcessDefinitionById(request.processDefinitionId)
        )

        val bpmnModelInstance = repositoryService.getProcessModel(processDefinition.id).use { inputStream ->
            Bpmn.readModelFromStream(inputStream)
        }

        val formattedCaseDefinitionVersion = request.buildingBlockDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val exportFile = ByteArrayOutputStream().use {
            Bpmn.writeModelToStream(it, bpmnModelInstance)
            ExportFile(
                PATH.format(
                    request.buildingBlockDefinitionId.key,
                    formattedCaseDefinitionVersion,
                    processDefinition.key
                ),
                it.toByteArray()
            )
        }
        return ExportResult(
            exportFile,
            emptySet()
        )
    }

    companion object {
        private const val PATH =
            "config/building-block/%s/%s/bpmn/%s.bpmn"
    }
}