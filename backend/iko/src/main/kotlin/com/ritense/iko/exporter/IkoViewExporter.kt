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
import com.ritense.iko.importer.IkoViewDto
import com.ritense.iko.service.IkoViewService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional(readOnly = true)
class IkoViewExporter(
    private val objectMapper: ObjectMapper,
    private val ikoViewService: IkoViewService,
) : Exporter<IkoViewExportRequest> {
    override fun supports() = IkoViewExportRequest::class.java

    override fun export(request: IkoViewExportRequest): ExportResult {
        val ikoView = ikoViewService.getByKey(request.ikoViewKey)
        val ikoViewDto = IkoViewDto(
            key = ikoView.key,
            ikoRepositoryConfigKey = ikoView.ikoRepositoryConfig.key,
            title = ikoView.title,
            properties = ikoView.properties,
        )

        val ikoViewExport = ExportFile(
            PATH.format(request.ikoViewKey, request.ikoViewKey),
            objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(ikoViewDto)
        )
        return ExportResult(
            ikoViewExport, setOf(
                IkoSearchActionsExportRequest(request.ikoViewKey),
                IkoListColumnsExportRequest(request.ikoViewKey),
                IkoTabsExportRequest(request.ikoViewKey),
            )
        )
    }

    companion object {
        const val PATH = "config/global/iko/%s/%s.iko-view.json"
    }
}
