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

package com.ritense.buildingblock.listener

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.event.CaseDefinitionCreatedEvent
import com.ritense.valtimo.contract.event.CaseDefinitionPreDeleteEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Transactional
@Service
@SkipComponentScan
class CaseDefinitionBuildingBlockLinkCaseEventListener(
    private val linkRepository: CaseDefinitionBuildingBlockLinkRepository
) {

    @EventListener(CaseDefinitionCreatedEvent::class)
    fun handleCaseDefinitionCreatedEvent(event: CaseDefinitionCreatedEvent) {
        if (event.duplicate) {
            linkRepository.findAllByCaseDefinitionId(event.basedOnCaseDefinitionId!!).forEach { link ->
                linkRepository.save(
                    CaseDefinitionBuildingBlockLink(
                        caseDefinitionId = event.caseDefinitionId,
                        buildingBlockDefinitionId = link.buildingBlockDefinitionId,
                        inputMappings = link.inputMappings,
                        outputMappings = link.outputMappings,
                        pluginConfigurationMappings = link.pluginConfigurationMappings
                    )
                )
            }
        }
    }

    @EventListener(CaseDefinitionPreDeleteEvent::class)
    fun handleCaseDefinitionPreDeleteEvent(event: CaseDefinitionPreDeleteEvent) {
        linkRepository.deleteAllByCaseDefinitionId(event.caseDefinitionId)
    }
}
