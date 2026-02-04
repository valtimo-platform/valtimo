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
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import com.ritense.exporter.request.BuildingBlockFormDefinitionExportRequest
import com.ritense.exporter.request.ExportRequest
import com.ritense.form.repository.FormDefinitionRepository
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.springframework.data.repository.findByIdOrNull
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
class BuildingBlockDefinitionExporter(
    private val objectMapper: ObjectMapper,
    val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val documentDefinitionService: DocumentDefinitionService,
    private val formDefinitionRepository: FormDefinitionRepository,
) : Exporter<BuildingBlockDefinitionExportRequest> {
    override fun supports() = BuildingBlockDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockDefinitionExportRequest): ExportResult {
        val definition = buildingBlockDefinitionRepository.findByIdOrNull(request.buildingBlockDefinitionId)
            ?: return ExportResult()
        val formattedVersion = definition.id.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val definitionExport = ExportFile(
            PATH.format(definition.id.key, formattedVersion, definition.id.key),
            objectMapper
                .writer(ExportPrettyPrinter())
                .writeValueAsBytes(
                    BuildingBlockDefinitionDto(
                        definition.id.key,
                        definition.id.versionTag.version,
                        definition.name,
                        definition.description,
                        definition.createdBy,
                        definition.createdDate,
                        definition.basedOnVersionTag?.version,
                        definition.final,
                    )
                )
        )

        val relatedExportRequests = mutableSetOf<ExportRequest>()
        relatedExportRequests.addAll(createDocumentDefinitionExportRequest(definition.id))
        relatedExportRequests.addAll(createFormDefinitionExportRequests(definition.id))

        return ExportResult(definitionExport, relatedExportRequests)
    }

    private fun createDocumentDefinitionExportRequest(buildingBlockDefinitionId: BuildingBlockDefinitionId): Set<BuildingBlockDocumentDefinitionExportRequest> {
        val documentDefinition = documentDefinitionService.findByBlueprintId(buildingBlockDefinitionId)
        return if (documentDefinition.isPresent) {
            setOf(
                BuildingBlockDocumentDefinitionExportRequest(
                    documentDefinition.get().id().name(),
                    buildingBlockDefinitionId
                )
            )
        } else {
            emptySet()
        }
    }

    private fun createFormDefinitionExportRequests(buildingBlockDefinitionId: BuildingBlockDefinitionId): Set<BuildingBlockFormDefinitionExportRequest> {
        val forms = formDefinitionRepository.findAllByBlueprintId(
            BlueprintType.BUILDING_BLOCK,
            buildingBlockDefinitionId.key,
            buildingBlockDefinitionId.versionTag
        )
        return forms.map { form ->
            BuildingBlockFormDefinitionExportRequest(
                form.name,
                buildingBlockDefinitionId
            )
        }.toSet()
    }

    companion object {
        private const val PATH =
            "config/building-block/%s/%s/building-block/definition/%s.building-block-definition.json"
    }
}