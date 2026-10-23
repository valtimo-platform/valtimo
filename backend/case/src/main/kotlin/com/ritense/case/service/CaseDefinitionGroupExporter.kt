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
import com.ritense.case.deployment.CaseDefinitionGroupExportDto
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.CaseDefinitionGroupExportRequest
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
class CaseDefinitionGroupExporter(
    private val objectMapper: ObjectMapper,
    private val groupService: CaseDefinitionGroupService
) : Exporter<CaseDefinitionGroupExportRequest> {

    override fun supports() = CaseDefinitionGroupExportRequest::class.java

    override fun export(request: CaseDefinitionGroupExportRequest): ExportResult {
        val group = groupService.getGroup(request.groupKey)
        val members = groupService.getMembers(request.groupKey)
        val listColumnsWithMappings = groupService.getListColumnsWithMappings(request.groupKey)
        val searchFieldsWithMappings = groupService.getSearchFieldsWithMappings(request.groupKey)

        val exportDto = CaseDefinitionGroupExportDto.of(
            group,
            members,
            listColumnsWithMappings,
            searchFieldsWithMappings
        )

        val exportFile = ExportFile(
            PATH.format(request.groupKey, request.groupKey),
            objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(exportDto)
        )

        return ExportResult(exportFile)
    }

    companion object {
        private const val PATH = "config/global/case-group/%s/%s.case-group.json"
    }
}
