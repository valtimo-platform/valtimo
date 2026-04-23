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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.listener

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinition
import com.ritense.buildingblock.domain.ProcessDefinitionBuildingBlockDefinitionId
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinitionArtwork
import com.ritense.buildingblock.repository.BuildingBlockDefinitionArtworkRepository
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockDecisionService
import com.ritense.buildingblock.service.BuildingBlockDocumentDefinitionService
import com.ritense.buildingblock.service.BuildingBlockFormDefinitionService
import com.ritense.buildingblock.service.BuildingBlockFormFlowDefinitionService
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.form.domain.FormProcessLink
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processlink.repository.ProcessLinkRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.event.BuildingBlockDefinitionCreatedEvent
import com.ritense.valtimo.service.OperatonProcessService
import org.operaton.bpm.model.bpmn.Bpmn
import org.springframework.context.event.EventListener
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Component
import java.io.ByteArrayOutputStream
import java.util.UUID

@Component
class BuildingBlockDefinitionEventListener(
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val jsonSchemaDocumentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val buildingBlockDefinitionArtworkRepository: BuildingBlockDefinitionArtworkRepository,
    private val buildingBlockDocumentDefinitionService: BuildingBlockDocumentDefinitionService,
    private val operatonProcessService: OperatonProcessService,
    private val buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService,
    private val buildingBlockFormFlowDefinitionService: BuildingBlockFormFlowDefinitionService,
    private val processLinkRepository: ProcessLinkRepository,
    private val buildingBlockDecisionService: BuildingBlockDecisionService,
) {

    @EventListener(BuildingBlockDefinitionCreatedEvent::class)
    @RunWithoutAuthorization
    fun handleBuildingBlockDefinitionCreated(event: BuildingBlockDefinitionCreatedEvent) {
        val basedOnId = event.basedOnBuildingBlockDefinitionId ?: return
        val newId = event.buildingBlockDefinitionId

        copyDocumentDefinition(newId.key, basedOnId, newId)
        copyDecisionDefinitions(basedOnId, newId)
        val formIdMapping = buildingBlockFormDefinitionService.copyFormDefinitions(basedOnId, newId)
        buildingBlockFormFlowDefinitionService.copyFormFlowDefinitions(basedOnId, newId)
        val newProcessDefinitionIds = copyProcessDefinitions(basedOnId, newId)
        rewriteFormProcessLinks(newProcessDefinitionIds, formIdMapping)
        copyArtwork(basedOnId, newId)
    }

    private fun copyDocumentDefinition(
        key: String,
        basedOnId: BuildingBlockDefinitionId,
        newId: BuildingBlockDefinitionId
    ) {
        val basedOnDocId = JsonSchemaDocumentDefinitionId.forBuildingBlock(key, basedOnId)
        val basedOnDefinition = jsonSchemaDocumentDefinitionRepository.findById(basedOnDocId)

        val newDocId = JsonSchemaDocumentDefinitionId.forBuildingBlock(key, newId)

        if (basedOnDefinition.isPresent) {
            val clone = JsonSchemaDocumentDefinition(newDocId, basedOnDefinition.get().getSchema())
            jsonSchemaDocumentDefinitionRepository.save(clone)
        } else {
            buildingBlockDocumentDefinitionService.ensureEmptyFor(key, newId.versionTag.toString())
        }
    }

    private fun copyProcessDefinitions(
        basedOnId: BuildingBlockDefinitionId,
        newId: BuildingBlockDefinitionId
    ): List<String> {
        val newProcessDefinitionIds = mutableListOf<String>()
        processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(basedOnId)
            .forEach { link ->
                val originalProcessDefinition =
                    operatonProcessService.getProcessDefinitionById(link.id.processDefinitionId.id)
                val bpmnModel = operatonProcessService.getBpmnModelInstanceByProcessDefinitionId(originalProcessDefinition.id)

                operatonProcessService.setBuildingBlockDefinitionProcessesVersionTags(bpmnModel, newId)

                val outputStream = ByteArrayOutputStream()
                Bpmn.writeModelToStream(outputStream, bpmnModel)

                val deployment = operatonProcessService.deploy(
                    newId,
                    originalProcessDefinition.resourceName,
                    outputStream.toByteArray().inputStream(),
                    false,
                    false,
                    originalProcessDefinition.versionTag,
                    originalProcessDefinition.id
                )

                val newProcessDefinitionId = deployment.deployedProcessDefinitions.first().id
                val newLinkId = ProcessDefinitionBuildingBlockDefinitionId(
                    ProcessDefinitionId.of(newProcessDefinitionId),
                    newId
                )

                processDefinitionBuildingBlockDefinitionRepository.save(
                    ProcessDefinitionBuildingBlockDefinition(newLinkId, link.main)
                )
                newProcessDefinitionIds.add(newProcessDefinitionId)
            }
        return newProcessDefinitionIds
    }

    private fun rewriteFormProcessLinks(
        newProcessDefinitionIds: List<String>,
        formIdMapping: Map<UUID, UUID>
    ) {
        if (formIdMapping.isEmpty() || newProcessDefinitionIds.isEmpty()) {
            return
        }
        newProcessDefinitionIds.forEach { processDefinitionId ->
            processLinkRepository.findByProcessDefinitionId(processDefinitionId)
                .filterIsInstance<FormProcessLink>()
                .forEach { link ->
                    val newFormId = formIdMapping[link.formDefinitionId] ?: return@forEach
                    processLinkRepository.save(link.copy(formDefinitionId = newFormId))
                }
        }
    }

    private fun copyDecisionDefinitions(
        basedOnId: BuildingBlockDefinitionId,
        newId: BuildingBlockDefinitionId
    ) {
        buildingBlockDecisionService.getDecisionDefinitions(basedOnId).forEach { oldDecision ->
            operatonProcessService.deploy(
                newId,
                oldDecision.resourceName,
                buildingBlockDecisionService.getDmnModel(oldDecision).inputStream()
            )
                ?: error { "Failed to duplicate decision ${oldDecision.key} for building block $newId" }
        }
    }

    private fun copyArtwork(
        basedOnId: BuildingBlockDefinitionId,
        newId: BuildingBlockDefinitionId
    ) {
        val existingArtwork = buildingBlockDefinitionArtworkRepository.findByIdOrNull(basedOnId) ?: return
        if (buildingBlockDefinitionArtworkRepository.existsById(newId)) {
            return
        }

        val newDefinition = buildingBlockDefinitionRepository.findByIdOrNull(newId) ?: return

        buildingBlockDefinitionArtworkRepository.save(
            BuildingBlockDefinitionArtwork(
                definition = newDefinition,
                imageBase64 = existingArtwork.imageBase64,
                id = newId
            )
        )
    }
}
