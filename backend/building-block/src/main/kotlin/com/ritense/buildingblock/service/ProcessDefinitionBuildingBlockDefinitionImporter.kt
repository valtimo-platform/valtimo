/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_PROCESS_DEFINITION
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.valtimo.service.OperatonProcessService

class ProcessDefinitionBuildingBlockDefinitionImporter(
    private val operatonProcessService: OperatonProcessService,
    private val buildingBlockDefinitionProcessDefinitionService: BuildingBlockDefinitionProcessDefinitionService,
) : Importer {
    override fun type() = BUILDING_BLOCK_PROCESS_DEFINITION

    override fun dependsOn(): Set<String> = setOf(BUILDING_BLOCK_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        request.content.inputStream().use {

            val deployment = operatonProcessService.deploy(
                request.buildingBlockDefinitionId,
                fileNameWithoutPath(request.fileName),
                it
            )

            buildingBlockDefinitionProcessDefinitionService.setMainLink(
                request.buildingBlockDefinitionId!!,
                null,
                ProcessDefinitionId(deployment.deployedProcessDefinitions.first().id),
                false
            )
        }
    }

    override fun partOfCaseDefinition() = false

    override fun partOfBuildingBlockDefinition() = true

    private fun fileNameWithoutPath(fileName: String): String {
        return fileName.substringAfterLast('/')
    }

    private companion object {
        val FILENAME_REGEX = """/bpmn/(?:.*/)?(.+)\.bpmn""".toRegex()
    }
}
