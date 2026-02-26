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
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockFormDefinitionExportRequest
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
class BuildingBlockFormDefinitionExporter(
    private val objectMapper: ObjectMapper,
    private val buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService
) : Exporter<BuildingBlockFormDefinitionExportRequest> {

    override fun supports() = BuildingBlockFormDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockFormDefinitionExportRequest): ExportResult {
        val formDefinition = buildingBlockFormDefinitionService
            .getFormDefinitionByName(request.buildingBlockDefinitionId, request.formDefinitionName)
            .orElseThrow {
                IllegalArgumentException(
                    "Form definition '${request.formDefinitionName}' not found for building block ${request.buildingBlockDefinitionId}"
                )
            }

        val formattedVersionTag = request.buildingBlockDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        return ExportResult(
            ExportFile(
                PATH.format(
                    request.buildingBlockDefinitionId.key,
                    formattedVersionTag,
                    formDefinition.name
                ),
                objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(formDefinition.formDefinition)
            )
        )
    }

    companion object {
        private const val PATH = "config/building-block/%s/%s/form/%s.form.json"
    }
}
