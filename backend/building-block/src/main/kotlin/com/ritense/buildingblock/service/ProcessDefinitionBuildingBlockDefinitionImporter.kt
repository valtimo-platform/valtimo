package com.ritense.buildingblock.service

import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.PROCESS_DEFINITION
import com.ritense.valtimo.service.OperatonProcessService

class ProcessDefinitionBuildingBlockDefinitionImporter(
    private val operatonProcessService: OperatonProcessService,
    private val
) : Importer {
    override fun type() = PROCESS_DEFINITION

    override fun dependsOn(): Set<String> = setOf(BUILDING_BLOCK_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        request.content.inputStream().use {
            operatonProcessService.deploy(null, fileNameWithoutPath(request.fileName), it)
        }
    }

    private fun fileNameWithoutPath(fileName: String): String {
        return fileName.substringAfterLast('/')
    }

    private companion object {
        val FILENAME_REGEX = """/bpmn/(?:.*/)?(.+)\.bpmn""".toRegex()
    }
}
