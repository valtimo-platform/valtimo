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
import com.ritense.exporter.request.GlobalDecisionDefinitionExportRequest
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.repository.OperatonDecisionDefinitionSpecificationHelper
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byKey
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byLatestVersion
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byVersion
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byVersionTag
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.BusinessRuleTask
import org.operaton.bpm.model.bpmn.instance.CallActivity
import java.io.ByteArrayOutputStream

/**
 * Exports the BPMN of a process definition that is not part of a case definition.
 *
 * Like [ProcessDefinitionExporter] this exporter walks the process and creates related export
 * requests for the called sub-processes and referenced decision definitions, so an exported process
 * can be imported on another environment together with everything it references.
 *
 * A reference that cannot be bundled is left out rather than failing the export: a `deployment`
 * binding or an expression based called element / decision reference cannot be resolved to a
 * specific definition, so it is skipped and reported by the import preview instead. A reference that
 * *can* be resolved statically (a literal key with a latest, version or versionTag binding) but
 * points at a definition that is not deployed here fails the export, matching [ProcessDefinitionExporter]:
 * bundling something that references a missing definition would produce a broken package.
 *
 * Building-block-tagged call activities are skipped: those have their own building block exporters.
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

        val relatedRequests = getCallActivityProcessDefinitionExportRequests(bpmnModelInstance) +
            getDecisionExportRequests(bpmnModelInstance)

        val exportFile = ByteArrayOutputStream().use {
            Bpmn.writeModelToStream(it, bpmnModelInstance)
            ExportFile(
                PATH.format(processDefinition.key),
                it.toByteArray()
            )
        }

        return ExportResult(
            exportFiles = setOf(exportFile),
            relatedRequests = relatedRequests,
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
     * Resolves the called sub-processes of the process to global export requests. A call activity
     * with a `deployment` binding or an expression based called element is skipped: it cannot be
     * bundled and the import preview reports it instead. Building-block-tagged call activities are
     * skipped as well, matching [ProcessDefinitionExporter]. A statically resolvable called element
     * that is not deployed here fails the export.
     */
    private fun getCallActivityProcessDefinitionExportRequests(
        bpmnModelInstance: BpmnModelInstance
    ): Set<GlobalProcessDefinitionExportRequest> {
        return bpmnModelInstance.getModelElementsByType(CallActivity::class.java).mapNotNull { callActivity ->
            val calledElement = callActivity.calledElement ?: return@mapNotNull null
            if (callActivity.operatonCalledElementVersionTag?.startsWith(OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX) == true) {
                return@mapNotNull null
            }
            if (callActivity.operatonCalledElementBinding == DEPLOYMENT_BINDING || isExpression(calledElement)) {
                return@mapNotNull null
            }
            val spec = byKey(calledElement)
            val processDefinition = checkNotNull(
                when (callActivity.operatonCalledElementBinding) {
                    "version" -> operatonRepositoryService.findProcessDefinition(spec.and(byVersion(callActivity.operatonCalledElementVersion.toInt())))
                    "versionTag" -> operatonRepositoryService.findProcessDefinition(spec.and(byVersionTag(callActivity.operatonCalledElementVersionTag)))
                    else -> operatonRepositoryService.findProcessDefinition(spec.and(byLatestVersion()))
                }
            ) {
                "Process definition with key '$calledElement' referenced by the process could not be found!"
            }
            GlobalProcessDefinitionExportRequest(processDefinition.id)
        }.toSet()
    }

    /**
     * Resolves the decision definitions referenced by business rule tasks to global export requests.
     * A reference with a `deployment` binding or an expression based decision reference is skipped
     * for the same reason as [getCallActivityProcessDefinitionExportRequests]; a statically
     * resolvable reference that is not deployed here fails the export.
     */
    private fun getDecisionExportRequests(
        bpmnModelInstance: BpmnModelInstance
    ): Set<GlobalDecisionDefinitionExportRequest> {
        return bpmnModelInstance.getModelElementsByType(BusinessRuleTask::class.java).mapNotNull { businessRuleTask ->
            val decisionRef = businessRuleTask.operatonDecisionRef ?: return@mapNotNull null
            if (businessRuleTask.operatonDecisionRefBinding == DEPLOYMENT_BINDING || isExpression(decisionRef)) {
                return@mapNotNull null
            }
            val spec = OperatonDecisionDefinitionSpecificationHelper.byKey(decisionRef)
            val decisionDefinition = checkNotNull(
                when (businessRuleTask.operatonDecisionRefBinding) {
                    "version" -> operatonRepositoryService.findDecisionDefinition(spec.and(OperatonDecisionDefinitionSpecificationHelper.byVersion(businessRuleTask.operatonDecisionRefVersion.toInt())))
                    "versionTag" -> operatonRepositoryService.findDecisionDefinition(spec.and(OperatonDecisionDefinitionSpecificationHelper.byVersionTag(businessRuleTask.operatonDecisionRefVersionTag)))
                    else -> operatonRepositoryService.findDecisionDefinition(spec.and(OperatonDecisionDefinitionSpecificationHelper.byLatestVersion()))
                }
            ) {
                "Decision definition with reference '$decisionRef' referenced by the process could not be found!"
            }
            GlobalDecisionDefinitionExportRequest(decisionDefinition.id)
        }.toSet()
    }

    /**
     * A called element or decision reference can be a static value or an expression that is only
     * resolved at runtime. An expression cannot be resolved to a definition to bundle, so it is left
     * out of the export.
     */
    private fun isExpression(value: String): Boolean = value.contains("\${") || value.contains("#{")

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
        private const val DEPLOYMENT_BINDING = "deployment"
    }
}
