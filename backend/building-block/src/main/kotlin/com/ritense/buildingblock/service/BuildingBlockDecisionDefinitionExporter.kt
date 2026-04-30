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

package com.ritense.buildingblock.service

import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockDecisionDefinitionExportRequest
import org.apache.commons.io.IOUtils
import org.operaton.bpm.engine.RepositoryService
import org.springframework.transaction.annotation.Transactional

@Transactional(readOnly = true)
class BuildingBlockDecisionDefinitionExporter(
    private val repositoryService: RepositoryService
) : Exporter<BuildingBlockDecisionDefinitionExportRequest> {

    override fun supports() = BuildingBlockDecisionDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockDecisionDefinitionExportRequest): ExportResult {
        val decisionDefinition = repositoryService.getDecisionDefinition(request.decisionDefinitionId)

        val formattedVersionTag = request.buildingBlockDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val exportFile = repositoryService.getDecisionModel(decisionDefinition.id).use { inputStream ->
            ExportFile(
                PATH.format(
                    request.buildingBlockDefinitionId.key,
                    formattedVersionTag,
                    decisionDefinition.key
                ),
                IOUtils.toByteArray(inputStream)
            )
        }
        return ExportResult(exportFile)
    }

    companion object {
        private const val PATH = "config/building-block/%s/%s/dmn/%s.dmn"
    }
}
