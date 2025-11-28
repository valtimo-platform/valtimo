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

package com.ritense.iko.exporter

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.iko.importer.IkoSeachActionDto
import com.ritense.iko.importer.IkoSeachActionsDto
import com.ritense.iko.service.IkoSeachActionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional(readOnly = true)
class IkoSeachActionsExporter(
    private val objectMapper: ObjectMapper,
    private val ikoSeachActionService: IkoSeachActionService,
) : Exporter<IkoSeachActionsExportRequest> {
    override fun supports() = IkoSeachActionsExportRequest::class.java

    override fun export(request: IkoSeachActionsExportRequest): ExportResult {
        val ikoSeachActions = ikoSeachActionService.findAll(
            ikoViewKey = request.ikoViewKey
        )
        if (ikoSeachActions.isEmpty()) {
            return ExportResult()
        }
        val ikoSeachActionsDto = IkoSeachActionsDto(
            ikoViewKey = request.ikoViewKey,
            ikoSeachActions = ikoSeachActions.map { ikoSeachAction ->
                IkoSeachActionDto(
                    key = ikoSeachAction.id.key,
                    title = ikoSeachAction.title,
                    properties = ikoSeachAction.properties,
                )
            }
        )

        val ikoSeachActionsExport = ExportFile(
            PATH.format(request.ikoViewKey, request.ikoViewKey),
            objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(ikoSeachActionsDto)
        )
        return ExportResult(
            ikoSeachActionsExport, ikoSeachActions.map { ikoSeachAction ->
                IkoSearchFieldsExportRequest(request.ikoViewKey, ikoSeachAction.id.key)
            }.toSet()
        )
    }

    companion object {
        const val PATH = "config/global/iko/%s/%s.iko-search-action.json"
    }
}
