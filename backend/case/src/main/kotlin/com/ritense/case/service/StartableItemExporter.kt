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

package com.ritense.case.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case.deployment.StartableItemDeploymentDto
import com.ritense.case.repository.StartableItemRepository
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.StartableItemExportRequest
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
class StartableItemExporter(
    private val objectMapper: ObjectMapper,
    private val startableItemRepository: StartableItemRepository,
) : Exporter<StartableItemExportRequest> {

    override fun supports() = StartableItemExportRequest::class.java

    override fun export(request: StartableItemExportRequest): ExportResult {
        val items = startableItemRepository.findAllByIdCaseDefinitionId(request.caseDefinitionId)
        if (items.isEmpty()) return ExportResult()

        val caseDefinitionKey = request.caseDefinitionId.key
        val formattedVersion = request.caseDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val dtos = items
            .sortedBy { it.sortOrder }
            .map(StartableItemDeploymentDto::of)

        val exportFile = ExportFile(
            PATH.format(caseDefinitionKey, formattedVersion, caseDefinitionKey),
            objectMapper
                .writer(ExportPrettyPrinter())
                .writeValueAsBytes(dtos)
        )

        return ExportResult(exportFile)
    }

    companion object {
        private const val PATH = "config/case/%s/%s/startable-item/%s.startable-items.json"
    }
}
