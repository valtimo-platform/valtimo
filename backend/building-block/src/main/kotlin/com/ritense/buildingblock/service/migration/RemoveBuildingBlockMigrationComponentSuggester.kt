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

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockInstruction
import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.case_.service.migration.DataMigrationComponentSuggester
import com.ritense.processdocument.migration.ProcessMigrationComponentSuggester
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.migration.MigrationComponentSuggester
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction

/**
 * Best-effort `removeBuildingBlock` suggestion: the building blocks the [source] owner linked that
 * the [target] owner no longer does — i.e. the blocks an owner *loses* across the version bump. Each
 * becomes an entry to remove, pre-filled the same way the standalone suggesters do:
 *
 * - `dataMigration` — from the [DataMigrationComponentSuggester] for the lost building block
 *   definition → `target` (the owner): field-name matched copy patches to transfer data back.
 * - `processMigration` — from the [ProcessMigrationComponentSuggester] for the same pair: the
 *   building block's process(es) mapped back onto the owner's process(es), with activity mappings.
 *
 * Works for both blueprint types, matching how each owner declares its directly-linked building
 * blocks: a case via its ad-hoc [CaseDefinitionBuildingBlockLink]s, a (parent) building block via
 * the building-block call activities in its own process(es). Any other blueprint type contributes
 * no links, so it returns null there. Suggestions are advisory — the user edits before saving.
 */
class RemoveBuildingBlockMigrationComponentSuggester(
    private val objectMapper: ObjectMapper,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val processLinkService: ProcessLinkService,
    private val dataMigrationComponentSuggester: DataMigrationComponentSuggester,
    private val processMigrationComponentSuggester: ProcessMigrationComponentSuggester,
) : MigrationComponentSuggester {

    override fun componentKey() = RemoveBuildingBlockMigrationComponentDeployer.REMOVE_BUILDING_BLOCK_COMPONENT_KEY

    override fun suggest(source: BlueprintId, target: BlueprintId): Any? {
        val targetKeys = directlyLinkedBuildingBlocks(target).map { it.key }.toSet()

        val instructions = directlyLinkedBuildingBlocks(source)
            .filter { it.key !in targetKeys }
            .distinctBy { it.key }
            .map { buildingBlockDefinitionId ->
                RemoveBuildingBlockInstruction(
                    buildingBlockKey = buildingBlockDefinitionId.key,
                    // Data/process are transferred back from the building block to the owner (target).
                    dataMigration = toDataPatches(
                        dataMigrationComponentSuggester.suggest(buildingBlockDefinitionId, target)
                    ),
                    processMigration = toProcessInstructions(
                        processMigrationComponentSuggester.suggest(buildingBlockDefinitionId, target)
                    ),
                )
            }

        return instructions.ifEmpty { null }
    }

    /**
     * The building block definitions directly linked to [owner], resolved per blueprint type:
     * a case's ad-hoc links, or the building-block call activities within a building block's own
     * process(es). Nested (transitive) building blocks are intentionally excluded — only the ones
     * the owner directly loses become a `removeBuildingBlock` entry.
     */
    private fun directlyLinkedBuildingBlocks(owner: BlueprintId): List<BuildingBlockDefinitionId> = when (owner) {
        is CaseDefinitionId -> caseDefinitionBuildingBlockLinkRepository
            .findAllByCaseDefinitionId(owner)
            .map { it.buildingBlockDefinitionId }

        is BuildingBlockDefinitionId -> processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(owner)
            .flatMap { processLinkService.getProcessLinks(it.id.processDefinitionId.id) }
            .filter { it.processLinkType == BuildingBlockProcessLink.PROCESS_LINK_TYPE }
            .map { (it as BuildingBlockProcessLink).buildingBlockDefinitionId }

        else -> emptyList()
    }

    // Keep only the copy patches; the standalone suggester's `value: null` removals clear stale
    // fields on a verbatim-copied document, which does not apply when transferring to a separate one.
    private fun toDataPatches(suggestion: Any?): List<DataMigrationPatch> =
        if (suggestion == null) emptyList()
        else objectMapper.convertValue(suggestion, object : TypeReference<List<DataMigrationPatch>>() {})
            .filter { it.source != null }

    private fun toProcessInstructions(suggestion: Any?): List<ProcessMigrationInstruction> =
        if (suggestion == null) emptyList()
        else objectMapper.convertValue(suggestion, object : TypeReference<List<ProcessMigrationInstruction>>() {})
}
