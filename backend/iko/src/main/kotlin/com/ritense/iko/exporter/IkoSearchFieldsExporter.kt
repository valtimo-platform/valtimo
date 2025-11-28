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
import com.ritense.iko.importer.IkoSearchFieldDto
import com.ritense.iko.importer.IkoSearchFieldsDto
import com.ritense.iko.service.IkoSearchFieldService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
@Transactional(readOnly = true)
class IkoSearchFieldsExporter(
    private val objectMapper: ObjectMapper,
    private val ikoSearchFieldService: IkoSearchFieldService,
) : Exporter<IkoSearchFieldsExportRequest> {
    override fun supports() = IkoSearchFieldsExportRequest::class.java

    override fun export(request: IkoSearchFieldsExportRequest): ExportResult {
        val ikoSearchFields = ikoSearchFieldService.findAllSearchFieldsByIkoSeachAction(
            ikoViewKey = request.ikoViewKey,
            ikoSeachActionKey = request.ikoSeachActionKey,
        )
        if (ikoSearchFields.isEmpty()) {
            return ExportResult()
        }
        val ikoSearchFieldsDto = IkoSearchFieldsDto(
            ikoViewKey = request.ikoViewKey,
            ikoSeachActionKey = request.ikoSeachActionKey,
            ikoSearchFields = ikoSearchFields.map { ikoSearchField ->
                IkoSearchFieldDto(
                    key = ikoSearchField.key,
                    title = ikoSearchField.title,
                    path = ikoSearchField.path,
                    dataType = ikoSearchField.dataType,
                    fieldType = ikoSearchField.fieldType,
                    matchType = ikoSearchField.matchType,
                    dropdownDataProvider = ikoSearchField.dropdownDataProvider,
                    required = ikoSearchField.required,
                )
            }
        )

        return ExportResult(
            ExportFile(
                PATH.format(request.ikoViewKey, request.ikoSeachActionKey),
                objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(ikoSearchFieldsDto)
            )
        )
    }

    companion object {
        const val PATH = "config/global/iko/%s/%s.iko-search-field.json"
    }
}
