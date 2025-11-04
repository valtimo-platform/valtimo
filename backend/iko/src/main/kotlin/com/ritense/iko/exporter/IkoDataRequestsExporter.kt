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
import com.ritense.iko.importer.IkoDataRequestDto
import com.ritense.iko.importer.IkoDataRequestsDto
import com.ritense.iko.service.IkoDataRequestService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional(readOnly = true)
class IkoDataRequestsExporter(
    private val objectMapper: ObjectMapper,
    private val ikoDataRequestService: IkoDataRequestService,
) : Exporter<IkoDataRequestsExportRequest> {
    override fun supports() = IkoDataRequestsExportRequest::class.java

    override fun export(request: IkoDataRequestsExportRequest): ExportResult {
        val ikoDataRequests = ikoDataRequestService.findAll(
            ikoDataAggregateKey = request.ikoDataAggregateKey
        )
        if (ikoDataRequests.isEmpty()) {
            return ExportResult()
        }
        val ikoDataRequestsDto = IkoDataRequestsDto(
            ikoDataAggregateKey = request.ikoDataAggregateKey,
            ikoDataRequests = ikoDataRequests.map { ikoDataRequest ->
                IkoDataRequestDto(
                    key = ikoDataRequest.id.key,
                    title = ikoDataRequest.title,
                    properties = ikoDataRequest.properties,
                )
            }
        )

        val ikoDataRequestsExport = ExportFile(
            PATH.format(request.ikoDataAggregateKey, request.ikoDataAggregateKey),
            objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(ikoDataRequestsDto)
        )
        return ExportResult(
            ikoDataRequestsExport, ikoDataRequests.map { ikoDataRequest ->
                IkoSearchFieldsExportRequest(request.ikoDataAggregateKey, ikoDataRequest.id.key)
            }.toSet()
        )
    }

    companion object {
        const val PATH = "config/global/iko/%s/%s.iko-data-request.json"
    }
}
