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
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import org.springframework.transaction.annotation.Transactional
import java.io.ByteArrayOutputStream

@Transactional(readOnly = true)
class BuildingBlockJsonSchemaDocumentDefinitionExporter(
    private val objectMapper: ObjectMapper,
    private val documentDefinitionService: JsonSchemaDocumentDefinitionService
) : Exporter<BuildingBlockDocumentDefinitionExportRequest> {
    override fun supports() = BuildingBlockDocumentDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockDocumentDefinitionExportRequest): ExportResult {
        val documentDefinition = if (request.name != "") {
            val documentDefinitionId = JsonSchemaDocumentDefinitionId.forBuildingBlock(request.name, request.buildingBlockDefinitionId)
            documentDefinitionService.findBy(documentDefinitionId).orElseThrow()
        } else {
            documentDefinitionService.findByBlueprintId(request.caseDefinitionId).orElseThrow()
        }

        val formattedCaseDefinitionVersion = request.buildingBlockDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val exportFile = ByteArrayOutputStream().use {
            objectMapper.writer(ExportPrettyPrinter()).writeValue(it, documentDefinition.schema.asJson())

            ExportFile(
                PATH.format(
                    request.buildingBlockDefinitionId.key,
                    formattedCaseDefinitionVersion,
                    documentDefinition.id!!.name()
                ),
                it.toByteArray()
            )
        }

        return ExportResult(exportFile)

    }

    companion object {
        private const val PATH = "config/building-block/%s/%s/document/definition/%s.schema.document-definition.json"
    }
}