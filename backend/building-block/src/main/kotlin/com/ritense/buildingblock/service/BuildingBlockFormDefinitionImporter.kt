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

import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_FORM_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_DEFINITION
import org.springframework.transaction.annotation.Transactional

@Transactional
class BuildingBlockFormDefinitionImporter(
    private val buildingBlockFormDefinitionService: BuildingBlockFormDefinitionService
) : Importer {

    override fun type() = BUILDING_BLOCK_FORM_DEFINITION

    override fun dependsOn() = setOf(BUILDING_BLOCK_DEFINITION, BUILDING_BLOCK_PROCESS_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(PATH_REGEX)

    override fun import(request: ImportRequest) {
        val buildingBlockDefinitionId = request.buildingBlockDefinitionId
            ?: throw IllegalArgumentException("Building block definition ID is required for form import")

        val formDefinitionAsString = request.content.toString(Charsets.UTF_8)
        val formName = fileNameWithoutPathAndExtension(request.fileName)

        // Check if form already exists
        val existingForm = buildingBlockFormDefinitionService
            .getFormDefinitionByName(buildingBlockDefinitionId, formName)

        if (existingForm.isPresent) {
            // Update existing form
            buildingBlockFormDefinitionService.updateFormDefinition(
                buildingBlockDefinitionId,
                existingForm.get().id!!,
                formName,
                formDefinitionAsString
            )
        } else {
            // Create new form
            buildingBlockFormDefinitionService.createFormDefinition(
                buildingBlockDefinitionId,
                formName,
                formDefinitionAsString,
                false
            )
        }
    }

    override fun partOfCaseDefinition() = false

    override fun partOfBuildingBlockDefinition() = true

    private fun fileNameWithoutPathAndExtension(fileName: String): String {
        return fileName
            .substringAfterLast('/')
            .substringBeforeLast('.')
            .substringBeforeLast('.')
    }

    private companion object {
        val PATH_REGEX = """/form/(?:.*/)?(.+)\.form\.json""".toRegex()
    }
}
