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

package com.ritense.buildingblock.service

import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import org.springframework.data.repository.findByIdOrNull
import org.springframework.transaction.annotation.Transactional
import java.util.Base64

@Transactional(readOnly = true)
class BuildingBlockDefinitionArtworkExporter(
    val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
) : Exporter<BuildingBlockDocumentDefinitionExportRequest> {
    override fun supports() = BuildingBlockDocumentDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockDocumentDefinitionExportRequest): ExportResult {
        val definition = buildingBlockDefinitionRepository.findByIdOrNull(request.buildingBlockDefinitionId)
            ?: return ExportResult()
        val artwork = definition.artwork ?: return ExportResult()
        val formattedVersion = definition.id.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val artworkExport = ExportFile(
            PATH.format(definition.id.key, formattedVersion),
            Base64.getDecoder().decode(artwork.imageBase64)
        )

        return ExportResult(artworkExport)

    }

    companion object {
        private const val PATH =
            "config/building-block/%s/%s/building-block/artwork.png"
    }
}
