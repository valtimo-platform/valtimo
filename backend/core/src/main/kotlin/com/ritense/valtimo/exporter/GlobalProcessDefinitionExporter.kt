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
import com.ritense.exporter.manifest.ArtifactManifestEntry
import com.ritense.exporter.manifest.ArtifactType
import com.ritense.exporter.manifest.ResolvableValue
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import java.io.ByteArrayOutputStream

/**
 * Exports the BPMN of a process definition that is not part of a case definition.
 *
 * Unlike [ProcessDefinitionExporter] this exporter does not create related export requests for
 * called sub-processes or referenced decision definitions. Those can be shared with other
 * processes and are exported and imported separately.
 */
class GlobalProcessDefinitionExporter(
    private val operatonRepositoryService: OperatonRepositoryService,
    private val repositoryService: RepositoryService,
) : Exporter<GlobalProcessDefinitionExportRequest> {

    override fun supports(): Class<GlobalProcessDefinitionExportRequest> =
        GlobalProcessDefinitionExportRequest::class.java

    override fun export(request: GlobalProcessDefinitionExportRequest): ExportResult {
        val processDefinition = requireNotNull(
            operatonRepositoryService.findProcessDefinitionById(request.processDefinitionId)
        ) {
            "Process definition with id '${request.processDefinitionId}' could not be found!"
        }

        val bpmnModelInstance = repositoryService.getProcessModel(processDefinition.id).use { inputStream ->
            Bpmn.readModelFromStream(inputStream)
        }

        val exportFile = ByteArrayOutputStream().use {
            Bpmn.writeModelToStream(it, bpmnModelInstance)
            ExportFile(
                PATH.format(processDefinition.key),
                it.toByteArray()
            )
        }

        return ExportResult(
            exportFiles = setOf(exportFile),
            relatedRequests = emptySet(),
            manifestArtifact = ArtifactManifestEntry(
                artifactVersionTag = ResolvableValue.of(getArtifactVersionTag(processDefinition)),
                title = ResolvableValue.of(processDefinition.name ?: processDefinition.key),
                type = ArtifactType.PROCESS_DEFINITION,
                // Filled in by the export service
                valtimoVersion = "",
                dependencies = emptyList(),
            ),
            manifestDependencies = emptySet(),
        )
    }

    /**
     * A BPMN file has no field the manifest can reference, so the version is written as a literal
     * value. The version tag of the model is preferred over the version of the deployment: the latter
     * differs per environment. A version tag that encodes a case or building block definition is not
     * a version of the process itself and is therefore ignored.
     */
    private fun getArtifactVersionTag(processDefinition: OperatonProcessDefinition): String =
        processDefinition.takeIf { it.getBlueprintId() == null }?.versionTag
            ?: processDefinition.version.toString()

    companion object {
        private const val PATH = "config/global/bpmn/%s.bpmn"
    }
}
