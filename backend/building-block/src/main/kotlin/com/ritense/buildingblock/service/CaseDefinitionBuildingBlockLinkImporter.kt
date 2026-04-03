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

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.buildingblock.web.rest.dto.CreateCaseDefinitionBuildingBlockLinkDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_BUILDING_BLOCK_LINK
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component

@SkipComponentScan
@Component
class CaseDefinitionBuildingBlockLinkImporter(
    private val objectMapper: ObjectMapper,
    private val linkRepository: CaseDefinitionBuildingBlockLinkRepository
) : Importer {

    override fun type() = CASE_BUILDING_BLOCK_LINK

    override fun dependsOn(): Set<String> = setOf(DOCUMENT_DEFINITION, BUILDING_BLOCK_DEFINITION)

    override fun partOfBuildingBlockDefinition() = false

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val dtos = objectMapper.readValue<List<CreateCaseDefinitionBuildingBlockLinkDto>>(
            request.content.toString(Charsets.UTF_8)
        )

        if (dtos.isEmpty()) return

        val caseDefinitionId = request.caseDefinitionId!!

        logger.debug { "Importing ${dtos.size} building block links for case definition '$caseDefinitionId'" }

        linkRepository.deleteAllByCaseDefinitionId(caseDefinitionId)

        dtos.forEach { dto ->
            val link = CaseDefinitionBuildingBlockLink(
                caseDefinitionId = caseDefinitionId,
                buildingBlockDefinitionId = BuildingBlockDefinitionId.of(
                    dto.buildingBlockDefinitionKey,
                    dto.buildingBlockDefinitionVersionTag
                ),
                inputMappings = dto.inputMappings,
                outputMappings = dto.outputMappings,
                pluginConfigurationMappings = dto.pluginConfigurationMappings
            )
            linkRepository.save(link)
        }
    }

    override fun partOfCaseDefinition() = true

    private companion object {
        val logger = KotlinLogging.logger {}
        val FILENAME_REGEX = """/building-block-link/([^/]+)\.case-building-block-links\.json""".toRegex()
    }
}
