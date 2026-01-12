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
import com.ritense.case.service.finalization.CaseDefinitionFinalizationCheckResult
import com.ritense.case.service.finalization.CaseDefinitionFinalizationChecker
import com.ritense.processlink.service.ProcessLinkService
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
) : CaseDefinitionFinalizationChecker {

    @Transactional(readOnly = true)
    override fun check(caseDefinitionId: CaseDefinitionId): CaseDefinitionFinalizationCheckResult {
        val hasNonFinalBuildingBlock = referencedBuildingBlockDefinitionIds(caseDefinitionId)
            .any { id -> buildingBlockDefinitionRepository.findByIdOrNull(id)?.final != true }

        return if (hasNonFinalBuildingBlock) {
            CaseDefinitionFinalizationCheckResult(false, "BUILDING_BLOCK_NOT_FINAL")
        } else {
            CaseDefinitionFinalizationCheckResult(true)
        }
    }

    private fun referencedBuildingBlockDefinitionIds(caseDefinitionId: CaseDefinitionId) =
        operatonProcessService.getDeployedDefinitions(caseDefinitionId)
            .asSequence()
            .flatMap { def -> processLinkService.getProcessLinks(def.id).asSequence() }
            .filter { it.processLinkType == BuildingBlockProcessLink.PROCESS_LINK_TYPE }
            .map { (it as BuildingBlockProcessLink).buildingBlockDefinitionId }
            .distinct()
}