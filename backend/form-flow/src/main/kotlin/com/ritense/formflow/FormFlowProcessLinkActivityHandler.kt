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

package com.ritense.formflow

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.formflow.domain.FormFlowProcessLink
import com.ritense.formflow.domain.definition.FormFlowDefinition
import com.ritense.formflow.domain.instance.FormFlowInstance
import com.ritense.formflow.service.FormFlowService
import com.ritense.logging.LoggableResource
import com.ritense.logging.withLoggingContext
import com.ritense.processdocument.domain.ProcessDefinitionId
import com.ritense.processdocument.helper.GetJsonSchemaDocumentHelper.getJsonSchemaDocumentIdOrNull
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.service.ProcessLinkActivityHandler
import com.ritense.processlink.web.rest.dto.ProcessLinkActivityResult
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.operaton.domain.OperatonTask
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import java.util.UUID
import org.operaton.bpm.engine.RuntimeService
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional

@Component
@SkipComponentScan
class FormFlowProcessLinkActivityHandler(
    private val formFlowService: FormFlowService,
    private val repositoryService: OperatonRepositoryService,
    private val processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService,
    documentService: DocumentService,
    runtimeService: RuntimeService,
) : AbstractFormFlowLinkTaskProvider(
    documentService, runtimeService
), ProcessLinkActivityHandler<FormFlowTaskOpenResultProperties> {

    override fun supports(processLink: ProcessLink): Boolean {
        return processLink is FormFlowProcessLink
    }

    @Transactional
    override fun openTask(
        task: OperatonTask,
        processLink: ProcessLink
    ): ProcessLinkActivityResult<FormFlowTaskOpenResultProperties> {
        withLoggingContext(
            mapOf(
                JsonSchemaDocument::class.java.canonicalName to task.processInstance?.businessKey,
                OperatonTask::class.java.canonicalName to task.id,
                ProcessLink::class.java.canonicalName to processLink.id.toString()
            )
        ) {
            processLink as FormFlowProcessLink

            val instances = formFlowService.findInstances(mapOf("taskInstanceId" to task.id))
            val instance = when (instances.size) {
                0 -> createFormFlowInstance(task, processLink)
                else -> instances[0]
            }
            return ProcessLinkActivityResult(
                processLink.id,
                FORM_FLOW_TASK_TYPE_KEY,
                task.assignee,
                task.dueDate,
                FormFlowTaskOpenResultProperties(
                    instance.id.id,
                    processLink.formDisplayType,
                    processLink.formSize,
                    processLink.subtitles
                )
            )
        }
    }

    override fun getStartEventObject(
        @LoggableResource(resourceType = OperatonProcessDefinition::class) processDefinitionId: String,
        @LoggableResource(resourceType = JsonSchemaDocument::class) documentId: UUID?,
        @LoggableResource("documentDefinitionName") documentDefinitionName: String?,
        processLink: ProcessLink
    ): ProcessLinkActivityResult<FormFlowTaskOpenResultProperties> {
        return withLoggingContext(ProcessLink::class, processLink.id) {
            processLink as FormFlowProcessLink
            val processDefinition = findProcessDefinition(processDefinitionId)
            val formFlowDefinition =
                resolveFormFlowDefinition(processDefinition, processLink.formFlowDefinitionKey, documentId)

            val additionalProperties = mutableMapOf<String, Any>(
                "processDefinitionKey" to processDefinition.key,
                // The key alone cannot identify a version: every building block version redeploys the same
                // process definition key. Pass the id on so submitting starts the linked version.
                "processDefinitionId" to processDefinition.id,
            )
            documentId?.let { additionalProperties["documentId"] = it }
            documentDefinitionName?.let { additionalProperties["documentDefinitionName"] = it }

            ProcessLinkActivityResult(
                processLink.id,
                FORM_FLOW_TASK_TYPE_KEY,
                null,
                null,
                FormFlowTaskOpenResultProperties(
                    formFlowService.save(
                        formFlowDefinition.createInstance(additionalProperties)
                    ).id.id,
                    processLink.formDisplayType,
                    processLink.formSize,
                    processLink.subtitles
                )
            )
        }
    }

    private fun createFormFlowInstance(task: OperatonTask, processLink: FormFlowProcessLink): FormFlowInstance {
        val additionalProperties = getAdditionalProperties(task)
        val processDefinition = findProcessDefinition(processLink.processDefinitionId)
        val formFlowDefinition = resolveFormFlowDefinition(
            processDefinition,
            processLink.formFlowDefinitionKey,
            task.getJsonSchemaDocumentIdOrNull(),
        )
        return formFlowService.save(formFlowDefinition.createInstance(additionalProperties))
    }

    private fun findProcessDefinition(processDefinitionId: String): OperatonProcessDefinition {
        return runWithoutAuthorization {
            repositoryService.findProcessDefinitionById(processDefinitionId)
        } ?: throw IllegalStateException("Process definition '$processDefinitionId' not found")
    }

    /**
     * A form flow definition is owned by a blueprint - either a case definition or a building block
     * definition - and `process_link.form_flow_definition_key` records only the key, so the blueprint has
     * to be derived. Three sources can supply one, tried in descending order of coverage:
     *
     * - the blueprint encoded in the process definition's version tag. It is authoritative when present
     *   and the only source that covers `BB:` blueprints as well as `CD:` ones, but it is absent on
     *   process definitions deployed before 13;
     * - the case document, which always carries the blueprint that owns the case. This covers process
     *   instances started before the 12 -> 13 upgrade: they keep executing the pre-upgrade process
     *   definition, which has no version tag and no link row of its own;
     * - the `process_definition_case_definition` link row, which only ever holds `CD:` blueprints because
     *   [com.ritense.valtimo.service.OperatonProcessService] is its only writer.
     *
     * The document is also the only source that can disambiguate a process definition shared by several
     * case types. The upgrade turns one legacy form flow key into one definition per case definition, so
     * from 13 on the key alone no longer identifies a definition - which is why there is no key-only
     * fallback here.
     */
    private fun resolveFormFlowDefinition(
        processDefinition: OperatonProcessDefinition,
        formFlowDefinitionKey: String,
        documentId: UUID? = null,
    ): FormFlowDefinition {
        val blueprintId = processDefinition.getBlueprintId()
            ?: documentId?.let { findBlueprintIdByDocumentId(it) }
            ?: processDefinitionCaseDefinitionService
                .findByProcessDefinitionIdOrNull(ProcessDefinitionId(processDefinition.id))
                ?.id?.caseDefinitionId

        return blueprintId?.let { formFlowService.findDefinitionOrNull(formFlowDefinitionKey, it) }
            ?: throw IllegalStateException(
                "FormFlow definition '$formFlowDefinitionKey' not found for process definition " +
                        "'${processDefinition.id}' and blueprint '${blueprintId ?: "unknown"}'"
            )
    }

    private fun findBlueprintIdByDocumentId(documentId: UUID): BlueprintId? {
        return runWithoutAuthorization {
            documentService.findBy(JsonSchemaDocumentId.existingId(documentId))
        }.orElse(null)?.definitionId()?.asBlueprintId()
    }

}
