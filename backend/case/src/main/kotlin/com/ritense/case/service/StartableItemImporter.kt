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

package com.ritense.case.service

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case.deployment.StartableItemDeploymentDto
import com.ritense.case.domain.StartableItem
import com.ritense.case.domain.StartableItemId
import com.ritense.case.repository.StartableItemRepository
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_BUILDING_BLOCK_LINK
import com.ritense.importer.ValtimoImportTypes.Companion.DOCUMENT_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.PROCESS_DOCUMENT_LINK
import com.ritense.importer.ValtimoImportTypes.Companion.STARTABLE_ITEM
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.transaction.annotation.Transactional

@Transactional
class StartableItemImporter(
    private val objectMapper: ObjectMapper,
    private val startableItemRepository: StartableItemRepository,
) : Importer {

    override fun type() = STARTABLE_ITEM

    override fun dependsOn(): Set<String> = setOf(
        DOCUMENT_DEFINITION,
        PROCESS_DOCUMENT_LINK,
        CASE_BUILDING_BLOCK_LINK,
    )

    override fun partOfCaseDefinition() = true

    override fun partOfBuildingBlockDefinition() = false

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        val dtos = try {
            objectMapper.readValue(
                request.content.toString(Charsets.UTF_8),
                object : TypeReference<List<StartableItemDeploymentDto>>() {}
            )
        } catch (e: Exception) {
            throw IllegalArgumentException(
                "Failed to parse file content as valid startable items: ${e.message}", e
            )
        }

        val caseDefinitionId = request.caseDefinitionId!!

        logger.debug { "Importing ${dtos.size} startable items for case definition '$caseDefinitionId'" }

        startableItemRepository.deleteAllByIdCaseDefinitionId(caseDefinitionId)
        startableItemRepository.flush()

        if (dtos.isEmpty()) {
            return
        }

        val entities = dtos.mapIndexed { index, dto ->
            StartableItem(
                id = StartableItemId(
                    caseDefinitionId = caseDefinitionId,
                    itemKey = dto.key,
                    itemType = dto.type,
                    itemVersionTag = dto.versionTag
                ),
                sortOrder = index
            )
        }

        startableItemRepository.saveAll(entities)
    }

    private companion object {
        val logger = KotlinLogging.logger {}
        val FILENAME_REGEX = """/startable-item/([^/]+)\.startable-items\.json""".toRegex()
    }
}
