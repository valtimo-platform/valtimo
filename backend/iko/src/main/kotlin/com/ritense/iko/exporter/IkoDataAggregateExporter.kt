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
import com.ritense.iko.importer.IkoDataAggregateDto
import com.ritense.iko.service.IkoDataAggregateService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional(readOnly = true)
class IkoDataAggregateExporter(
    private val objectMapper: ObjectMapper,
    private val ikoDataAggregateService: IkoDataAggregateService,
) : Exporter<IkoDataAggregateExportRequest> {
    override fun supports() = IkoDataAggregateExportRequest::class.java

    override fun export(request: IkoDataAggregateExportRequest): ExportResult {
        val ikoDataAggregate = ikoDataAggregateService.getByKey(request.ikoDataAggregateKey)
        val ikoDataAggregateDto = IkoDataAggregateDto(
            key = ikoDataAggregate.key,
            ikoRepositoryConfigKey = ikoDataAggregate.ikoRepositoryConfig.key,
            title = ikoDataAggregate.title,
            properties = ikoDataAggregate.properties,
        )

        val ikoDataAggregateExport = ExportFile(
            PATH.format(request.ikoDataAggregateKey, request.ikoDataAggregateKey),
            objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(ikoDataAggregateDto)
        )
        return ExportResult(
            ikoDataAggregateExport, setOf(
                IkoDataRequestsExportRequest(request.ikoDataAggregateKey),
                IkoListColumnsExportRequest(request.ikoDataAggregateKey),
                IkoTabsExportRequest(request.ikoDataAggregateKey),
            )
        )
    }

    companion object {
        const val PATH = "config/global/iko/%s/%s.iko-data-aggregate.json"
    }
}
