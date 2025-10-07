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

package com.ritense.case_.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.domain.header.CaseHeaderWidgetId
import com.ritense.case_.repository.CaseHeaderWidgetRepository
import com.ritense.case_.rest.dto.CaseHeaderWidgetCreateDto
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.DocumentDefinitionExportRequest
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
class CaseHeaderWidgetExporter(
    private val objectMapper: ObjectMapper,
    private val caseHeaderWidgetRepository: CaseHeaderWidgetRepository
) : Exporter<DocumentDefinitionExportRequest> {

    override fun supports() = DocumentDefinitionExportRequest::class.java

    override fun export(request: DocumentDefinitionExportRequest): ExportResult {
        val caseDefinitionId = request.caseDefinitionId
        val caseDefinitionKey = caseDefinitionId.key
        val formattedCaseDefinitionVersion = caseDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val headerId = CaseHeaderWidgetId(caseDefinitionKey, caseDefinitionId.versionTag.toString())
        val headerWidget = caseHeaderWidgetRepository.findById(headerId).orElse(null)
            ?: return ExportResult()

        val dto = CaseHeaderWidgetCreateDto(
            type = headerWidget.type,
            highContrast = headerWidget.highContrast,
            properties = headerWidget.properties
        )

        val file = ExportFile(
            PATH.format(caseDefinitionKey, formattedCaseDefinitionVersion, caseDefinitionKey),
            objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(dto)
        )

        return ExportResult(file)
    }

    companion object {
        private const val PATH = "config/case/%s/%s/case/header-widget/%s.case-header-widget.json"
    }
}