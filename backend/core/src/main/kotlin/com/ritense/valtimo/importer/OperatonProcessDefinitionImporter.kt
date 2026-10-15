/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.importer

import com.ritense.importer.ImportContext
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.CASE_DEFINITION
import com.ritense.importer.ValtimoImportTypes.Companion.PROCESS_DEFINITION
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.service.OperatonProcessService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.instance.Process
import org.springframework.transaction.annotation.Transactional

@Transactional
class OperatonProcessDefinitionImporter(
    private val operatonProcessService: OperatonProcessService
) : Importer {
    override fun type() = PROCESS_DEFINITION

    override fun dependsOn(): Set<String> = setOf(CASE_DEFINITION)

    override fun supports(fileName: String) = fileName.matches(FILENAME_REGEX)

    override fun import(request: ImportRequest) {
        request.caseDefinitionId?.let { detachProcessesMissingFromPackage(request, it) }
        request.content.inputStream().use {
            operatonProcessService.deploy(request.caseDefinitionId, fileNameWithoutPath(request.fileName), it)
        }
    }

    // Runs before any afterImport, while the version is still a draft: a final package finalises it only then
    private fun detachProcessesMissingFromPackage(request: ImportRequest, caseDefinitionId: CaseDefinitionId) {
        val bpmnFiles = ImportContext.caseDefinitionFiles().filter { supports(it.fileName) }
        if (bpmnFiles.none { it.fileName == request.fileName }) {
            return
        }
        if (!ImportContext.claimOncePerRun(DetachClaim(type(), caseDefinitionId))) {
            return
        }

        val processKeys = bpmnFiles.flatMapTo(mutableSetOf()) { processIds(it.content) }
        operatonProcessService.getAllDefinitions(caseDefinitionId)
            .filter { it.key !in processKeys }
            .forEach { definition ->
                logger.info { "Detaching process '${definition.key}' from case definition $caseDefinitionId: the imported package does not contain it" }
                operatonProcessService.detachProcessDefinition(definition.id, caseDefinitionId)
            }
    }

    private fun processIds(bpmn: ByteArray): List<String> {
        return bpmn.inputStream().use { stream ->
            Bpmn.readModelFromStream(stream).getModelElementsByType(Process::class.java).map { it.id }
        }
    }

    private fun fileNameWithoutPath(fileName: String): String {
        return fileName.substringAfterLast('/')
    }

    // Importer type is part of the key so a subclass registered alongside this one claims separately
    private data class DetachClaim(val importerType: String, val caseDefinitionId: CaseDefinitionId)

    private companion object {
        val logger = KotlinLogging.logger {}
        val FILENAME_REGEX = """/bpmn/(?:.*/)?(.+)\.bpmn""".toRegex()
    }
}
