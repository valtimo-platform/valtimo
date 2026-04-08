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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockFormDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockFormFlowDefinitionExportRequest
import com.ritense.formflow.domain.definition.configuration.FormFlowDefinition
import com.ritense.formflow.domain.definition.configuration.step.FormStepTypeProperties
import com.ritense.formflow.handler.FormFlowStepTypeFormHandler
import com.ritense.formflow.service.FormFlowService
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
class BuildingBlockFormFlowDefinitionExporter(
    private val objectMapper: ObjectMapper,
    private val formFlowService: FormFlowService,
) : Exporter<BuildingBlockFormFlowDefinitionExportRequest> {

    override fun supports() = BuildingBlockFormFlowDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockFormFlowDefinitionExportRequest): ExportResult {
        val buildingBlockDefinitionId = request.buildingBlockDefinitionId
        val definition = formFlowService.findDefinition(request.formFlowDefinitionKey, buildingBlockDefinitionId)

        val relatedFormRequests = definition.steps
            .map { it.type }
            .filter { it.name == FormFlowStepTypeFormHandler.TYPE }
            .map { type ->
                val formDefinitionName = (type.properties as FormStepTypeProperties).definition
                BuildingBlockFormDefinitionExportRequest(formDefinitionName, buildingBlockDefinitionId)
            }
            .toSet()

        val formattedVersionTag = buildingBlockDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        return ExportResult(
            ExportFile(
                PATH.format(buildingBlockDefinitionId.key, formattedVersionTag, definition.id.key),
                objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(FormFlowDefinition.fromEntity(definition))
            ),
            relatedFormRequests
        )
    }

    companion object {
        private const val PATH = "config/building-block/%s/%s/form-flow/%s.form-flow.json"
    }
}
