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

package com.ritense.processlink.service

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.databind.node.TextNode
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.importer.exception.ImportServiceException
import com.ritense.processlink.autodeployment.ProcessLinkDeployDto
import com.ritense.processlink.web.rest.dto.MissingReferenceDto
import com.ritense.processlink.web.rest.dto.MissingReferenceType
import com.ritense.processlink.web.rest.dto.ProcessLinkPluginConfigurationPreviewDto
import com.ritense.processlink.web.rest.dto.ProcessDefinitionImportPreviewResponseDto
import com.ritense.processlink.web.rest.dto.ReplacedElementDto
import com.ritense.processlink.web.rest.dto.ReplacedElementType
import com.ritense.valtimo.contract.importer.ImportPreviewContributor
import com.ritense.valtimo.operaton.repository.OperatonDecisionDefinitionSpecificationHelper
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import io.github.oshai.kotlinlogging.KotlinLogging
import org.operaton.bpm.model.bpmn.Bpmn
import org.operaton.bpm.model.bpmn.instance.BusinessRuleTask
import org.operaton.bpm.model.bpmn.instance.CallActivity
import java.io.InputStream
import java.util.zip.ZipInputStream

/**
 * Inspects a process definition import before it is applied, so the user can be told what the
 * package contains, which plugin configurations have to be mapped, and what the package refers to
 * that is not available here.
 */
class ProcessDefinitionImportPreviewService(
    private val objectMapper: ObjectMapper,
    private val importPreviewContributors: List<ImportPreviewContributor>,
    private val processLinkService: ProcessLinkService,
    private val repositoryService: OperatonRepositoryService,
) {

    fun preview(inputStream: InputStream): ProcessDefinitionImportPreviewResponseDto {
        val zipEntries = readZipEntries(inputStream)

        val bpmnEntries = zipEntries.filterKeys { it.matches(BPMN_REGEX) }
        if (bpmnEntries.isEmpty()) {
            throw ImportServiceException("No process definition found in the provided archive")
        }

        val processDefinitionKeys = bpmnEntries.keys.map { fileName ->
            BPMN_REGEX.matchEntire(fileName)!!.groupValues[1]
        }

        val pluginConfigurations = importPreviewContributors.flatMap { it.contributePreview(zipEntries) }
            .map {
                ProcessLinkPluginConfigurationPreviewDto(
                    pluginConfigurationId = it.pluginConfigurationId,
                    pluginDefinitionKey = it.pluginDefinitionKey,
                    pluginActionDefinitionKey = it.pluginActionDefinitionKey,
                    processDefinitionKey = it.processDefinitionKey,
                    activityId = it.activityId,
                    existsInTargetEnvironment = it.existsInTargetEnvironment,
                )
            }

        val bundledFormNames = zipEntries.keys
            .mapNotNull { FORM_REGEX.matchEntire(it)?.groupValues?.get(1) }
            .toSet()

        return runWithoutAuthorization {
            val existingProcessDefinitionKeys = processDefinitionKeys.filter {
                repositoryService.findLatestProcessDefinition(it) != null
            }

            ProcessDefinitionImportPreviewResponseDto(
                processDefinitionKeys = processDefinitionKeys,
                existingProcessDefinitionKeys = existingProcessDefinitionKeys,
                pluginConfigurations = pluginConfigurations,
                missingReferences = findMissingBpmnReferences(bpmnEntries, processDefinitionKeys, zipEntries) +
                    findMissingProcessLinkReferences(zipEntries, bundledFormNames),
                elementsToReplace = findElementsToReplace(
                    existingProcessDefinitionKeys,
                    zipEntries,
                    bundledFormNames,
                ),
            )
        }
    }

    /**
     * The elements bundled in the package that already exist here and will be replaced by the
     * import: the processes, the referenced decision definitions, and the referenced forms.
     */
    private fun findElementsToReplace(
        existingProcessDefinitionKeys: List<String>,
        zipEntries: Map<String, ByteArray>,
        bundledFormNames: Set<String>,
    ): List<ReplacedElementDto> {
        val replacedProcesses = existingProcessDefinitionKeys.map {
            ReplacedElementDto(ReplacedElementType.PROCESS_DEFINITION, it)
        }

        val replacedDecisions = zipEntries.keys
            .mapNotNull { DMN_REGEX.matchEntire(it)?.groupValues?.get(1) }
            .filter { globalDecisionDefinitionExists(it) }
            .map { ReplacedElementDto(ReplacedElementType.DECISION_DEFINITION, it) }

        val replacedForms = findReplacedProcessLinkReferences(zipEntries)
            .filter { it.type != ReplacedElementType.FORM || it.key in bundledFormNames }

        return (replacedProcesses + replacedDecisions + replacedForms).distinct()
    }

    private fun globalDecisionDefinitionExists(decisionDefinitionKey: String): Boolean {
        return repositoryService.findDecisionDefinition(
            OperatonDecisionDefinitionSpecificationHelper.byKey(decisionDefinitionKey)
                .and(OperatonDecisionDefinitionSpecificationHelper.byNotLinkedToCaseDefinition())
                .and(OperatonDecisionDefinitionSpecificationHelper.byLatestVersion())
        ) != null
    }

    private fun findReplacedProcessLinkReferences(
        zipEntries: Map<String, ByteArray>,
    ): List<ReplacedElementDto> {
        return zipEntries.filterKeys { it.matches(PROCESS_LINK_REGEX) }
            .flatMap { (fileName, content) ->
                parseProcessLinkNodes(fileName, content).mapNotNull { node ->
                    getReplacedReference(node)
                }
            }
    }

    private fun getReplacedReference(node: JsonNode): ReplacedElementDto? {
        val deployDto = parseDeployDto(node) ?: return null
        return processLinkService.getProcessLinkMapper(deployDto.processLinkType)
            // A process definition outside a case definition has no blueprint
            .getReplacedReference(deployDto, null)
    }

    private fun findMissingBpmnReferences(
        bpmnEntries: Map<String, ByteArray>,
        processDefinitionKeys: List<String>,
        zipEntries: Map<String, ByteArray>,
    ): List<MissingReferenceDto> {
        val decisionKeysInPackage = zipEntries.keys.mapNotNull { DMN_REGEX.matchEntire(it)?.groupValues?.get(1) }

        return bpmnEntries.flatMap { (fileName, content) ->
            val processDefinitionKey = BPMN_REGEX.matchEntire(fileName)!!.groupValues[1]
            val bpmnModel = try {
                content.inputStream().use { Bpmn.readModelFromStream(it) }
            } catch (e: Exception) {
                logger.info(e) { "Could not read '$fileName' while previewing the import" }
                return@flatMap emptyList()
            }

            val missingSubProcesses = bpmnModel.getModelElementsByType(CallActivity::class.java)
                .mapNotNull { callActivity ->
                    val calledElement = callActivity.calledElement ?: return@mapNotNull null
                    if (calledElement in processDefinitionKeys) return@mapNotNull null
                    if (repositoryService.findLatestProcessDefinition(calledElement) != null) return@mapNotNull null
                    MissingReferenceDto(
                        type = MissingReferenceType.SUB_PROCESS,
                        reference = calledElement,
                        activityId = callActivity.id,
                        processDefinitionKey = processDefinitionKey,
                    )
                }

            val missingDecisions = bpmnModel.getModelElementsByType(BusinessRuleTask::class.java)
                .mapNotNull { businessRuleTask ->
                    val decisionRef = businessRuleTask.operatonDecisionRef ?: return@mapNotNull null
                    if (decisionRef in decisionKeysInPackage) return@mapNotNull null
                    if (decisionDefinitionExists(decisionRef)) return@mapNotNull null
                    MissingReferenceDto(
                        type = MissingReferenceType.DECISION_DEFINITION,
                        reference = decisionRef,
                        activityId = businessRuleTask.id,
                        processDefinitionKey = processDefinitionKey,
                    )
                }

            missingSubProcesses + missingDecisions
        }
    }

    private fun decisionDefinitionExists(decisionDefinitionKey: String): Boolean {
        return repositoryService.findDecisionDefinition(
            OperatonDecisionDefinitionSpecificationHelper.byKey(decisionDefinitionKey)
                .and(OperatonDecisionDefinitionSpecificationHelper.byLatestVersion())
        ) != null
    }

    /**
     * A form referenced by a process link is now bundled into the package (see the global
     * exporter), so a form present in the archive is not reported as missing even when it is not yet
     * on this environment: the import deploys it. Only forms that are neither here nor in the package
     * remain a blocking missing reference.
     */
    private fun findMissingProcessLinkReferences(
        zipEntries: Map<String, ByteArray>,
        bundledFormNames: Set<String>,
    ): List<MissingReferenceDto> {
        return zipEntries.filterKeys { it.matches(PROCESS_LINK_REGEX) }
            .flatMap { (fileName, content) ->
                val processDefinitionKey = PROCESS_LINK_REGEX.matchEntire(fileName)!!.groupValues[1]
                parseProcessLinkNodes(fileName, content).mapNotNull { node ->
                    getMissingReference(node, processDefinitionKey)
                }
            }
            .filter { it.type != MissingReferenceType.FORM || it.reference !in bundledFormNames }
    }

    private fun parseProcessLinkNodes(fileName: String, content: ByteArray): List<JsonNode> {
        val jsonTree = try {
            objectMapper.readTree(content.toString(Charsets.UTF_8))
        } catch (e: Exception) {
            logger.info(e) { "Could not read '$fileName' while previewing the import" }
            return emptyList()
        }
        if (jsonTree !is ArrayNode) {
            return emptyList()
        }
        return jsonTree.toList()
    }

    private fun getMissingReference(node: JsonNode, processDefinitionKey: String): MissingReferenceDto? {
        val deployDto = parseDeployDto(node) ?: return null
        return processLinkService.getProcessLinkMapper(deployDto.processLinkType)
            // A process definition outside a case definition has no blueprint
            .getMissingReference(deployDto, null)
            ?.copy(processDefinitionKey = processDefinitionKey)
    }

    private fun parseDeployDto(node: JsonNode): ProcessLinkDeployDto? {
        if (node !is ObjectNode) {
            return null
        }
        // The process definition is only known once the process is deployed, so a placeholder is used
        if (!node.has(PROCESS_DEFINITION_ID)) {
            node.set<ObjectNode>(PROCESS_DEFINITION_ID, TextNode.valueOf(PROCESS_DEFINITION_ID_PLACEHOLDER))
        }
        return try {
            objectMapper.treeToValue<ProcessLinkDeployDto>(node)
        } catch (e: Exception) {
            logger.info(e) { "Could not read process link while previewing the import" }
            null
        }
    }

    private fun readZipEntries(inputStream: InputStream): Map<String, ByteArray> {
        val entries = mutableMapOf<String, ByteArray>()

        try {
            ZipInputStream(inputStream).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    if (!entry.isDirectory) {
                        entries[entry.name] = zis.readBytes()
                    }
                    entry = zis.nextEntry
                }
            }
        } catch (e: Exception) {
            throw ImportServiceException("Archive could not be read: ${e.message}").apply { initCause(e) }
        }

        if (entries.isEmpty()) {
            throw ImportServiceException("Archive was empty or not a zip")
        }

        return entries
    }

    companion object {
        private val logger = KotlinLogging.logger {}
        private const val PROCESS_DEFINITION_ID = "processDefinitionId"
        private const val PROCESS_DEFINITION_ID_PLACEHOLDER = "-"
        private val BPMN_REGEX = """.*/?global/bpmn/(?:.*/)?(.+)\.bpmn""".toRegex()
        private val DMN_REGEX = """.*/?global/dmn/(?:.*/)?(.+)\.dmn""".toRegex()
        private val FORM_REGEX = """.*/?global/form/(?:.*/)?(.+)\.form\.json""".toRegex()
        private val PROCESS_LINK_REGEX = """.*/?global/process-link/(?:.*/)?(.+)\.process-link\.json""".toRegex()
    }
}
