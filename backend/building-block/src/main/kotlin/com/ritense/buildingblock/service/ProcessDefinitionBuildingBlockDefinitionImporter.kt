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
