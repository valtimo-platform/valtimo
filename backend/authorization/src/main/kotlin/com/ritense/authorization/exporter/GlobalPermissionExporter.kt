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

package com.ritense.authorization.exporter

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.deployment.PermissionDto
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.GlobalExportRequest
import org.springframework.transaction.annotation.Transactional

@Transactional
class GlobalPermissionExporter(
    private val objectMapper: ObjectMapper,
    private val permissionRepository: PermissionRepository
) : Exporter<GlobalExportRequest> {

    override fun supports(): Class<GlobalExportRequest> = GlobalExportRequest::class.java

    override fun export(request: GlobalExportRequest): ExportResult {
        val permissions = permissionRepository.findAll()

        if (permissions.isEmpty()) {
            return ExportResult()
        }

        val permissionDtos = permissions.map { PermissionDto.from(it) }

        return ExportResult(
            ExportFile(
                PATH,
                objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(permissionDtos)
            )
        )
    }

    companion object {
        private const val PATH = "config/global/permission/global.permission.json"
    }
}