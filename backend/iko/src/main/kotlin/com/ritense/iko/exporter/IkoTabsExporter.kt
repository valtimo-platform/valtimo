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
import com.ritense.iko.importer.IkoTabsDto
import com.ritense.iko.service.IkoTabService
import com.ritense.tab.web.rest.dto.TabDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional(readOnly = true)
class IkoTabsExporter(
    private val objectMapper: ObjectMapper,
    private val ikoTabService: IkoTabService,
) : Exporter<IkoTabsExportRequest> {
    override fun supports() = IkoTabsExportRequest::class.java

    override fun export(request: IkoTabsExportRequest): ExportResult {
        val ikoTabs = ikoTabService.findAllTabsByIkoViewKey(
            ikoViewKey = request.ikoViewKey
        )
        if (ikoTabs.isEmpty()) {
            return ExportResult()
        }
        val ikoTabsDto = IkoTabsDto(
            ikoViewKey = request.ikoViewKey,
            ikoTabs = ikoTabs.map { ikoTab -> TabDto.from(ikoTab) }
        )

        val ikoTabsExport = ExportFile(
            PATH.format(request.ikoViewKey, request.ikoViewKey),
            objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(ikoTabsDto)
        )
        return ExportResult(
            ikoTabsExport, ikoTabs.map { ikoTab ->
                IkoWidgetsExportRequest(request.ikoViewKey, ikoTab.key)
            }.toSet()
        )
    }

    companion object {
        const val PATH = "config/global/iko/%s/%s.iko-tab.json"
    }
}
