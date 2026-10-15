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

package com.ritense.case_.caseconfiguration.exporter

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.caseconfiguration.importer.CaseConfigurationDto
import com.ritense.case_.caseconfiguration.service.CaseConfigurationService
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.DocumentDefinitionExportRequest
import org.springframework.transaction.annotation.Transactional

// Exports declarations only: environment values belong to the environment and never travel
@Transactional(readOnly = true)
class CaseConfigurationExporter(
    private val objectMapper: ObjectMapper,
    private val caseConfigurationService: CaseConfigurationService,
) : Exporter<DocumentDefinitionExportRequest> {

    override fun supports() = DocumentDefinitionExportRequest::class.java

    override fun export(request: DocumentDefinitionExportRequest): ExportResult {
        val declarations = caseConfigurationService.getDeclarations(request.caseDefinitionId)
        if (declarations.isEmpty()) {
            return ExportResult()
        }

        val formattedVersion = request.caseDefinitionId.versionTag.let { "${it.major}-${it.minor}-${it.patch}" }
        return ExportResult(
            ExportFile(
                PATH.format(request.caseDefinitionId.key, formattedVersion, request.name),
                objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(declarations.map(CaseConfigurationDto::of))
            )
        )
    }

    companion object {
        private const val PATH = "config/case/%s/%s/case/configuration/%s.case-configuration.json"
    }
}
