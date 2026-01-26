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
import com.ritense.iko.importer.IkoSearchActionDto
import com.ritense.iko.importer.IkoSearchActionsDto
import com.ritense.iko.service.IkoSearchActionService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional(readOnly = true)
class IkoSearchActionsExporter(
    private val objectMapper: ObjectMapper,
    private val ikoSearchActionService: IkoSearchActionService,
) : Exporter<IkoSearchActionsExportRequest> {
    override fun supports() = IkoSearchActionsExportRequest::class.java

    override fun export(request: IkoSearchActionsExportRequest): ExportResult {
        val ikoSearchActions = ikoSearchActionService.findAll(
            ikoViewKey = request.ikoViewKey
        )
        if (ikoSearchActions.isEmpty()) {
            return ExportResult()
        }
        val ikoSearchActionsDto = IkoSearchActionsDto(
            ikoViewKey = request.ikoViewKey,
            ikoSearchActions = ikoSearchActions.map { ikoSearchAction ->
                IkoSearchActionDto(
                    key = ikoSearchAction.id.key,
                    title = ikoSearchAction.title,
                    properties = ikoSearchAction.properties,
                )
            }
        )

        val ikoSearchActionsExport = ExportFile(
            PATH.format(request.ikoViewKey, request.ikoViewKey),
            objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(ikoSearchActionsDto)
        )
        return ExportResult(
            ikoSearchActionsExport, ikoSearchActions.map { ikoSearchAction ->
                IkoSearchFieldsExportRequest(request.ikoViewKey, ikoSearchAction.id.key)
            }.toSet()
        )
    }

    companion object {
        const val PATH = "config/global/iko/%s/%s.iko-search-action.json"
    }
}
