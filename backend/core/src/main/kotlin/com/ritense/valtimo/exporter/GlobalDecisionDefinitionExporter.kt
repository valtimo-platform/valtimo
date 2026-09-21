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

package com.ritense.valtimo.exporter

import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.GlobalDecisionDefinitionExportRequest
import org.apache.commons.io.IOUtils
import org.operaton.bpm.engine.RepositoryService

/**
 * Exports the DMN of a decision definition that is not part of a case definition into the
 * `config/global` folder structure. A reduced copy of [DecisionDefinitionExporter] that writes the
 * decision keyed by its key only, without a case definition path segment.
 */
class GlobalDecisionDefinitionExporter(
    private val repositoryService: RepositoryService
) : Exporter<GlobalDecisionDefinitionExportRequest> {
    override fun supports(): Class<GlobalDecisionDefinitionExportRequest> =
        GlobalDecisionDefinitionExportRequest::class.java

    override fun export(request: GlobalDecisionDefinitionExportRequest): ExportResult {
        val decisionDefinition = repositoryService.getDecisionDefinition(request.decisionDefinitionId)

        val exportFile = repositoryService.getDecisionModel(decisionDefinition.id).use { inputStream ->
            ExportFile(
                PATH.format(decisionDefinition.key),
                IOUtils.toByteArray(inputStream)
            )
        }
        return ExportResult(exportFile)
    }

    companion object {
        private const val PATH = "config/global/dmn/%s.dmn"
    }
}
