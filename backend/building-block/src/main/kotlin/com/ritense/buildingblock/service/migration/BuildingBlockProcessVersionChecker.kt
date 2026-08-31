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

package com.ritense.buildingblock.service.migration

import com.ritense.buildingblock.repository.BuildingBlockInstanceRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.engine.RuntimeService
import java.util.UUID

/** Asserts the block's running process is on the BPMN of the version it now claims. A version owns its process definition exclusively, so there is always a token to move — and guessing the mapping would move it silently into an activity that changed meaning. */
class BuildingBlockProcessVersionChecker(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val runtimeService: RuntimeService,
    private val repositoryService: RepositoryService,
) {

    /** Fail unless the running process of the block owning [documentId] is on [target]'s process definition. */
    fun assertProcessOnVersion(documentId: UUID, target: BuildingBlockDefinitionId) {
        val instance = buildingBlockInstanceRepository.findByDocumentId(documentId)
            ?: throw NoSuchElementException("No building block instance found for document '$documentId'")
        val processInstanceId = instance.processInstanceId ?: return
        val processInstance = runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult()
            ?: return

        val runningDefinitionId = processInstance.processDefinitionId
        val processDefinitionKey = repositoryService.getProcessDefinition(runningDefinitionId).key
        val expectedDefinitionId = findProcessDefinitionId(target, processDefinitionKey)
            ?: throw IllegalStateException(
                "Building block instance '${instance.id}' is running process '$processDefinitionKey', which " +
                    "building block version '$target' does not have. The migration plan on '$target' must " +
                    "carry a processMigration component mapping '$processDefinitionKey' onto the process that " +
                    "version does have."
            )

        check(runningDefinitionId == expectedDefinitionId) {
            "Building block instance '${instance.id}' has landed on '$target' but its process is still " +
                "running '$runningDefinitionId' instead of that version's '$expectedDefinitionId'. Every " +
                "building block version deploys its own BPMN, so a running process has to be migrated onto " +
                "it explicitly, even when the BPMN did not change: give the migration plan on '$target' a " +
                "processMigration component for '$processDefinitionKey'."
        }
    }

    private fun findProcessDefinitionId(
        target: BuildingBlockDefinitionId,
        processDefinitionKey: String,
    ): String? = processDefinitionBuildingBlockDefinitionRepository
        .findAllByIdBuildingBlockDefinitionId(target)
        .firstOrNull { it.processDefinitionKey == processDefinitionKey }
        ?.id
        ?.processDefinitionId
        ?.id
}
