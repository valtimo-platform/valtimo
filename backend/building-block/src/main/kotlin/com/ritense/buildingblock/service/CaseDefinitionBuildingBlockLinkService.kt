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

import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.web.rest.dto.CaseDefinitionBuildingBlockLinkDto
import com.ritense.buildingblock.web.rest.dto.CreateCaseDefinitionBuildingBlockLinkDto
import com.ritense.buildingblock.web.rest.dto.UpdateCaseDefinitionBuildingBlockLinkDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@SkipComponentScan
@Service
class CaseDefinitionBuildingBlockLinkService(
    private val linkRepository: CaseDefinitionBuildingBlockLinkRepository,
    private val buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository
) {

    @Transactional(readOnly = true)
    fun getLinks(caseDefinitionId: CaseDefinitionId): List<CaseDefinitionBuildingBlockLinkDto> {
        return linkRepository.findAllByCaseDefinitionId(caseDefinitionId)
            .map { CaseDefinitionBuildingBlockLinkDto.from(it) }
    }

    @Transactional(readOnly = true)
    fun getLink(
        caseDefinitionId: CaseDefinitionId,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): CaseDefinitionBuildingBlockLinkDto {
        val link = findLinkOrThrow(caseDefinitionId, buildingBlockDefinitionId)
        return CaseDefinitionBuildingBlockLinkDto.from(link)
    }

    @Transactional(readOnly = true)
    fun findLink(
        caseDefinitionId: CaseDefinitionId,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): CaseDefinitionBuildingBlockLink? {
        return linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(
            caseDefinitionId,
            buildingBlockDefinitionId
        )
    }

    @Transactional
    fun createLink(
        caseDefinitionId: CaseDefinitionId,
        dto: CreateCaseDefinitionBuildingBlockLinkDto
    ): CaseDefinitionBuildingBlockLinkDto {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of(
            dto.buildingBlockDefinitionKey,
            dto.buildingBlockDefinitionVersionTag
        )

        if (!buildingBlockDefinitionRepository.existsById(buildingBlockDefinitionId)) {
            throw NoSuchElementException("Building block definition not found: $buildingBlockDefinitionId")
        }

        val link = CaseDefinitionBuildingBlockLink(
            caseDefinitionId = caseDefinitionId,
            buildingBlockDefinitionId = buildingBlockDefinitionId,
            inputMappings = dto.inputMappings,
            outputMappings = dto.outputMappings,
            pluginConfigurationMappings = dto.pluginConfigurationMappings
        )

        return CaseDefinitionBuildingBlockLinkDto.from(linkRepository.save(link))
    }

    @Transactional
    fun updateLink(
        caseDefinitionId: CaseDefinitionId,
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        dto: UpdateCaseDefinitionBuildingBlockLinkDto
    ): CaseDefinitionBuildingBlockLinkDto {
        val link = findLinkOrThrow(caseDefinitionId, buildingBlockDefinitionId)

        link.inputMappings = dto.inputMappings
        link.outputMappings = dto.outputMappings
        link.pluginConfigurationMappings = dto.pluginConfigurationMappings

        return CaseDefinitionBuildingBlockLinkDto.from(linkRepository.save(link))
    }

    @Transactional
    fun deleteLink(
        caseDefinitionId: CaseDefinitionId,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ) {
        val link = findLinkOrThrow(caseDefinitionId, buildingBlockDefinitionId)
        linkRepository.delete(link)
    }

    private fun findLinkOrThrow(
        caseDefinitionId: CaseDefinitionId,
        buildingBlockDefinitionId: BuildingBlockDefinitionId
    ): CaseDefinitionBuildingBlockLink {
        return linkRepository.findByCaseDefinitionIdAndBuildingBlockDefinitionId(
            caseDefinitionId,
            buildingBlockDefinitionId
        ) ?: throw NoSuchElementException(
            "Case definition building block link not found for case '$caseDefinitionId' and building block '$buildingBlockDefinitionId'"
        )
    }
}
