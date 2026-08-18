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

package com.ritense.processlink.exporter

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportPrettyPrinter
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.manifest.ArtifactDependency
import com.ritense.exporter.request.ExportRequest
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper
import com.ritense.valtimo.operaton.service.OperatonRepositoryService

/**
 * Exports the process links of a process definition that is not part of a case definition.
 *
 * Like [ProcessLinkExporter] this exporter creates related export requests for the definitions a
 * process link points at, through [ProcessLinkMapper.createGlobalRelatedExportRequests], so they are
 * bundled into the `config/global` export. Form flow links contribute nothing: form flows are
 * case/building-block scoped and cannot occur on a case-unlinked process.
 */
class GlobalProcessLinkExporter(
    private val objectMapper: ObjectMapper,
    private val processLinkService: ProcessLinkService,
    private val repositoryService: OperatonRepositoryService,
) : Exporter<GlobalProcessDefinitionExportRequest> {

    override fun supports(): Class<GlobalProcessDefinitionExportRequest> =
        GlobalProcessDefinitionExportRequest::class.java

    /**
     * The exported file is always written, also when the process has no process links: it is the
     * complete set of process links for the process, and an importer only removes process links of a
     * process it receives a file for.
     */
    override fun export(request: GlobalProcessDefinitionExportRequest): ExportResult {
        val processLinks = processLinkService.getProcessLinks(request.processDefinitionId)

        val relatedRequests = mutableSetOf<ExportRequest>()
        val manifestDependencies = mutableSetOf<ArtifactDependency>()
        val exportDtos = processLinks.map { processLink ->
            val mapper = processLinkService.getProcessLinkMapper(processLink.processLinkType)

            relatedRequests.addAll(mapper.createGlobalRelatedExportRequests(processLink))
            manifestDependencies.addAll(mapper.toManifestDependencies(processLink))

            mapper.toProcessLinkExportResponseDto(processLink)
        }

        return ExportResult(
            exportFiles = setOf(
                ExportFile(
                    PATH.format(getProcessDefinitionKey(request.processDefinitionId)),
                    objectMapper.writer(ExportPrettyPrinter()).writeValueAsBytes(exportDtos)
                )
            ),
            relatedRequests = relatedRequests,
            // The process definition of the request is the artifact of this export
            manifestArtifact = null,
            manifestDependencies = manifestDependencies,
        )
    }

    private fun getProcessDefinitionKey(processDefinitionId: String): String {
        return requireNotNull(
            repositoryService.findProcessDefinition(
                OperatonProcessDefinitionSpecificationHelper.byId(processDefinitionId)
            )
        ).key
    }

    companion object {
        private const val PATH = "config/global/process-link/%s.process-link.json"
    }
}
