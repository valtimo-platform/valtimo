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
import org.operaton.bpm.engine.runtime.ProcessInstance
import java.util.UUID

/** Asserts the block's running process is on the BPMN of the version it now claims. A version owns its process definition exclusively, so there is always a token to move — and guessing the mapping would move it silently into an activity that changed meaning. */
class BuildingBlockProcessVersionChecker(
    private val buildingBlockInstanceRepository: BuildingBlockInstanceRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val runtimeService: RuntimeService,
    private val repositoryService: RepositoryService,
) {

    /** Fail unless every running process of the block owning [documentId] is on [target]'s process definition. */
    fun assertProcessOnVersion(documentId: UUID, target: BuildingBlockDefinitionId) {
        val instance = buildingBlockInstanceRepository.findByDocumentId(documentId)
            ?: throw NoSuchElementException("No building block instance found for document '$documentId'")
        val processInstanceId = instance.processInstanceId ?: return

        runningProcessesOf(documentId, processInstanceId).forEach { processInstance ->
            assertOnVersion(processInstance.processDefinitionId, instance.id, target)
        }
    }

    /**
     * Every process the block is running: the one it records, plus anything else carrying its document id as
     * business key. A block may own more than one process definition, and one its own BPMN calls is a separate
     * process instance the recorded id alone never reached — so it was never asserted onto the target version and
     * its token was left on the old deployment in silence (G65).
     */
    private fun runningProcessesOf(documentId: UUID, processInstanceId: String): List<ProcessInstance> {
        val recorded = runtimeService.createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult()
        val byBusinessKey = runtimeService.createProcessInstanceQuery()
            .processInstanceBusinessKey(documentId.toString())
            .list()
        // The recorded one is kept even when the business key does not name it, so this never asserts less than it used to.
        return (listOfNotNull(recorded) + byBusinessKey).distinctBy { it.processInstanceId }
    }

    private fun assertOnVersion(
        runningDefinitionId: String,
        instanceId: UUID,
        target: BuildingBlockDefinitionId,
    ) {
        val processDefinitionKey = repositoryService.getProcessDefinition(runningDefinitionId).key
        val expectedDefinitionId = findProcessDefinitionId(target, processDefinitionKey)
            ?: throw IllegalStateException(
                "Building block instance '$instanceId' is running process '$processDefinitionKey', which " +
                    "building block version '$target' does not have. The migration plan on '$target' must " +
                    "carry a processMigration component mapping '$processDefinitionKey' onto the process that " +
                    "version does have."
            )

        check(runningDefinitionId == expectedDefinitionId) {
            "Building block instance '$instanceId' has landed on '$target' but its process is still " +
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
