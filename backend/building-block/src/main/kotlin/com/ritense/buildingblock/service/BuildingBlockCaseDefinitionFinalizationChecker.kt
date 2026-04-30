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

import com.ritense.buildingblock.processlink.domain.BuildingBlockProcessLink
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.repository.ProcessDefinitionBuildingBlockDefinitionRepository
import com.ritense.case.service.finalization.CaseDefinitionFinalizationCheckResult
import com.ritense.case.service.finalization.CaseDefinitionFinalizationChecker
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class BuildingBlockCaseDefinitionFinalizationChecker(
    private val operatonProcessService: OperatonProcessService,
    private val processLinkService: ProcessLinkService,
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository,
    private val processDefinitionBuildingBlockDefinitionRepository: ProcessDefinitionBuildingBlockDefinitionRepository,
    private val caseDefinitionBuildingBlockLinkRepository: CaseDefinitionBuildingBlockLinkRepository,
) : CaseDefinitionFinalizationChecker {

    @Transactional(readOnly = true)
    override fun check(caseDefinitionId: CaseDefinitionId): CaseDefinitionFinalizationCheckResult {
        // Get all building blocks including nested ones
        val allBuildingBlockIds = getAllReferencedBuildingBlockIds(caseDefinitionId)

        val hasNonFinalBuildingBlock = allBuildingBlockIds
            .any { id -> buildingBlockDefinitionRepository.findByIdOrNull(id)?.final != true }

        return if (hasNonFinalBuildingBlock) {
            CaseDefinitionFinalizationCheckResult(false, "BUILDING_BLOCK_NOT_FINAL")
        } else {
            CaseDefinitionFinalizationCheckResult(true)
        }
    }

    /**
     * Gets all building block definition IDs referenced by a case, including nested building blocks.
     */
    private fun getAllReferencedBuildingBlockIds(caseDefinitionId: CaseDefinitionId): Set<BuildingBlockDefinitionId> {
        val processReferenced = referencedBuildingBlockDefinitionIds(caseDefinitionId).toSet()
        val adHocReferenced = caseDefinitionBuildingBlockLinkRepository
            .findAllByCaseDefinitionId(caseDefinitionId)
            .map { it.buildingBlockDefinitionId }
            .toSet()
        return collectAllNestedBuildingBlocks(processReferenced + adHocReferenced)
    }

    /**
     * Recursively collects all nested building block IDs from a set of building blocks.
     */
    private fun collectAllNestedBuildingBlocks(
        buildingBlockIds: Set<BuildingBlockDefinitionId>,
        visited: MutableSet<BuildingBlockDefinitionId> = mutableSetOf()
    ): Set<BuildingBlockDefinitionId> {
        val result = mutableSetOf<BuildingBlockDefinitionId>()

        for (bbId in buildingBlockIds) {
            if (bbId in visited) continue
            visited.add(bbId)
            result.add(bbId)

            // Get nested building blocks from this building block's processes
            val nestedIds = getNestedBuildingBlockIds(bbId)
            result.addAll(collectAllNestedBuildingBlocks(nestedIds, visited))
        }

        return result
    }

    /**
     * Gets building block IDs referenced by processes within a building block.
     */
    private fun getNestedBuildingBlockIds(buildingBlockId: BuildingBlockDefinitionId): Set<BuildingBlockDefinitionId> {
        // Get all process definitions for this building block
        val processDefinitionLinks = processDefinitionBuildingBlockDefinitionRepository
            .findAllByIdBuildingBlockDefinitionId(buildingBlockId)

        return processDefinitionLinks
            .asSequence()
            .flatMap { link ->
                processLinkService.getProcessLinks(link.id.processDefinitionId.id).asSequence()
            }
            .filter { it.processLinkType == BuildingBlockProcessLink.PROCESS_LINK_TYPE }
            .map { (it as BuildingBlockProcessLink).buildingBlockDefinitionId }
            .toSet()
    }

    private fun referencedBuildingBlockDefinitionIds(caseDefinitionId: CaseDefinitionId) =
        operatonProcessService.getDeployedDefinitions(caseDefinitionId)
            .asSequence()
            .flatMap { def -> processLinkService.getProcessLinks(def.id).asSequence() }
            .filter { it.processLinkType == BuildingBlockProcessLink.PROCESS_LINK_TYPE }
            .map { (it as BuildingBlockProcessLink).buildingBlockDefinitionId }
            .distinct()
}