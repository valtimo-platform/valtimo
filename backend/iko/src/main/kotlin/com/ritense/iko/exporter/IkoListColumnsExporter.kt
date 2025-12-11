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
import com.ritense.iko.importer.IkoListColumnsDto
import com.ritense.iko.service.IkoListColumnService
import com.ritense.search.importer.ListColumnDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional(readOnly = true)
class IkoListColumnsExporter(
    private val objectMapper: ObjectMapper,
    private val ikoListColumnService: IkoListColumnService,
) : Exporter<IkoListColumnsExportRequest> {
    override fun supports() = IkoListColumnsExportRequest::class.java

    override fun export(request: IkoListColumnsExportRequest): ExportResult {
        val ikoListColumns = ikoListColumnService.findAllColumnsByIkoViewKey(
            ikoViewKey = request.ikoViewKey
        )
        if (ikoListColumns.isEmpty()) {
            return ExportResult()
        }
        val ikoListColumnsDto = IkoListColumnsDto(
            ikoViewKey = request.ikoViewKey,
            ikoListColumns = ikoListColumns.map { ikoListColumn ->
                ListColumnDto(
                    id = null,
                    key = ikoListColumn.key,
                    title = ikoListColumn.title,
                    path = ikoListColumn.path,
                    displayType = ikoListColumn.displayType,
                    sortable = ikoListColumn.sortable,
                    defaultSort = ikoListColumn.defaultSort,
                )
            }
        )

        return ExportResult(
            ExportFile(
                PATH.format(request.ikoViewKey, request.ikoViewKey),
                objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(ikoListColumnsDto)
            )
        )
    }

    companion object {
        const val PATH = "config/global/iko/%s/%s.iko-list-column.json"
    }
}
