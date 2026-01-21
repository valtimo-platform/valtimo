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

import com.ritense.exporter.ExportFile
import com.ritense.exporter.ExportResult
import com.ritense.exporter.Exporter
import com.ritense.exporter.request.BuildingBlockProcessDefinitionExportRequest
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.process.ProcessConstants.OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byKey
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byLatestVersion
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byVersion
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byVersionTag
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.BpmnModelInstance
import org.operaton.bpm.model.bpmn.instance.CallActivity
import java.io.ByteArrayOutputStream

class BuildingBlockProcessDefinitionExporter(
    private val operatonRepositoryService: OperatonRepositoryService,
    private val repositoryService: RepositoryService,
) : Exporter<BuildingBlockProcessDefinitionExportRequest> {
    override fun supports() = BuildingBlockProcessDefinitionExportRequest::class.java

    override fun export(request: BuildingBlockProcessDefinitionExportRequest): ExportResult {
        val processDefinition = requireNotNull(
            operatonRepositoryService.findProcessDefinitionById(request.processDefinitionId)
        )

        val bpmnModelInstance = repositoryService.getProcessModel(processDefinition.id).use { inputStream ->
            Bpmn.readModelFromStream(inputStream)
        }

        val formattedCaseDefinitionVersion = request.buildingBlockDefinitionId.versionTag.let {
            "${it.major}-${it.minor}-${it.patch}"
        }

        val subProcessDefinitionExportRequests =
            getCallActivityProcessDefinitionExportRequests(bpmnModelInstance, request.buildingBlockDefinitionId)
        //val decisionExportRequests = getDecisionExportRequests(request.buildingBlockDefinitionId, bpmnModelInstance)

        val exportFile = ByteArrayOutputStream().use {
            Bpmn.writeModelToStream(it, bpmnModelInstance)
            ExportFile(
                PATH.format(
                    request.buildingBlockDefinitionId.key,
                    formattedCaseDefinitionVersion,
                    processDefinition.key
                ),
                it.toByteArray()
            )
        }
        return ExportResult(
            exportFile,
            subProcessDefinitionExportRequests //+ decisionExportRequests
        )
    }

    private fun getCallActivityProcessDefinitionExportRequests(
        bpmnModelInstance: BpmnModelInstance,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): Set<BuildingBlockProcessDefinitionExportRequest> {
        val expectedVersionTag = OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX + buildingBlockDefinitionId.toString()
        return bpmnModelInstance.getModelElementsByType(CallActivity::class.java).mapNotNull {
            if (it.calledElement != null) {
                val spec = byKey(it.calledElement)
                val processDefinition = checkNotNull(
                    when (it.operatonCalledElementBinding) {
                        "version" -> operatonRepositoryService.findProcessDefinition(spec.and(byVersion(it.operatonCalledElementVersion.toInt())))
                        "versionTag" -> operatonRepositoryService.findProcessDefinition(spec.and(byVersionTag(it.operatonCalledElementVersionTag)))
                        "deployment" -> null
                        else -> operatonRepositoryService.findProcessDefinition(spec.and(byLatestVersion()))
                    }
                ) {
                    "Process definition with key '${it.calledElement}' could not be found!"
                }
                // Skip processes from DIFFERENT building blocks - they are exported via their own chain
                // Include processes from the same building block OR unlinked processes
                val versionTag = processDefinition.versionTag
                val isFromDifferentBuildingBlock = versionTag != null &&
                    versionTag.startsWith(OPERATON_BUILDING_BLOCK_DEFINITION_VERSION_TAG_PREFIX) &&
                    versionTag != expectedVersionTag
                if (isFromDifferentBuildingBlock) {
                    null
                } else {
                    BuildingBlockProcessDefinitionExportRequest(processDefinition.id, buildingBlockDefinitionId)
                }
            } else {
                null
            }
        }.toSet()
    }

    // TODO: Uncomment when decision definitions are supported
//    private fun getDecisionExportRequests(buildingBlockDefinitionId: BuildingBlockDefinitionId, bpmnModelInstance: BpmnModelInstance): Set<DecisionDefinitionExportRequest> {
//        return bpmnModelInstance.getModelElementsByType(BusinessRuleTask::class.java).mapNotNull {
//            if (it.operatonDecisionRef != null) {
//                val spec = OperatonDecisionDefinitionSpecificationHelper.byKey(it.operatonDecisionRef)
//                val decisionDefinitionId = checkNotNull(
//                    when (it.operatonDecisionRefBinding) {
//                        "version" -> operatonRepositoryService.findDecisionDefinition(spec.and(OperatonDecisionDefinitionSpecificationHelper.byVersion(it.operatonDecisionRefVersion.toInt())))
//                        "versionTag" -> operatonRepositoryService.findDecisionDefinition(spec.and(OperatonDecisionDefinitionSpecificationHelper.byVersionTag(it.operatonDecisionRefVersionTag)))
//                        "deployment" -> null
//                        else -> operatonRepositoryService.findDecisionDefinition(spec.and(OperatonDecisionDefinitionSpecificationHelper.byLatestVersion()))
//                    }
//                ) {
//                    "Decision definition with reference '${it.operatonDecisionRef}' could not be found!"
//                }.id
//                BuildingBlockDecisionDefinitionExportRequest(decisionDefinitionId, buildingBlockDefinitionId)
//            } else {
//                null
//            }
//        }.toSet()
//    }

    companion object {
        private const val PATH =
            "config/building-block/%s/%s/bpmn/%s.bpmn"
    }
}