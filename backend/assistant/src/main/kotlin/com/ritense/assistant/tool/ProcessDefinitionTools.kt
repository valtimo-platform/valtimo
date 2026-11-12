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

package com.ritense.assistant.tool

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.assistant.service.PendingActionService
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byKey
import com.ritense.valtimo.operaton.repository.OperatonProcessDefinitionSpecificationHelper.Companion.byLatestVersion
import com.ritense.valtimo.operaton.service.OperatonRepositoryService
import dev.langchain4j.agent.tool.P
import dev.langchain4j.agent.tool.Tool
import org.operaton.bpm.engine.RepositoryService
import org.operaton.bpm.model.bpmn.Bpmn
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.context.SecurityContextHolder
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

open class ProcessDefinitionTools(
    private val operatonRepositoryService: OperatonRepositoryService,
    private val repositoryService: RepositoryService,
    private val pendingActionService: PendingActionService,
    private val objectMapper: ObjectMapper
) {

    @Tool("Get process definition BPMN XML. Returns the full BPMN 2.0 XML content of the latest version of a process definition.")
    fun getProcessDefinition(
        @P("The process definition key (e.g., 'loan-process')") processDefinitionKey: String
    ): String {
        requireAdminRole()

        return runWithoutAuthorization {
            val procDef = operatonRepositoryService.findProcessDefinition(
                byKey(processDefinitionKey).and(byLatestVersion())
            ) ?: return@runWithoutAuthorization "Process definition '$processDefinitionKey' not found."

            val bpmnModel = repositoryService.getBpmnModelInstance(procDef.id)
            val outputStream = ByteArrayOutputStream()
            Bpmn.writeModelToStream(outputStream, bpmnModel)
            val bpmnXml = outputStream.toString(Charsets.UTF_8)

            buildString {
                appendLine("Process Definition: ${procDef.name ?: procDef.key}")
                appendLine("Key: ${procDef.key}")
                appendLine("Version: ${procDef.version} (latest)")
                appendLine()
                appendLine("BPMN XML:")
                appendLine(bpmnXml)
            }
        }
    }

    @Tool("List all process definitions. Returns a list of process definition keys and versions.")
    fun listProcessDefinitions(
        @P("If true, only return the latest version of each process. Default is true.") latestOnly: Boolean?
    ): String {
        requireAdminRole()

        return runWithoutAuthorization {
            val spec = if (latestOnly != false) {
                byLatestVersion()
            } else {
                byKey("%") // Match all
            }

            val processDefinitions = operatonRepositoryService.findProcessDefinitions(spec)

            if (processDefinitions.isEmpty()) {
                return@runWithoutAuthorization "No process definitions found."
            }

            buildString {
                appendLine("Process Definitions:")
                processDefinitions.forEach { pd ->
                    appendLine("- ${pd.name ?: pd.key} (${pd.key} v${pd.version})")
                }
            }
        }
    }

    @Tool("""Explain what a specific BPMN element does in a process definition.
        Useful for understanding process flow and element configuration.""")
    fun explainBpmnElement(
        @P("The process definition key") processDefinitionKey: String,
        @P("The BPMN element ID to explain (e.g., 'Task_Review', 'Gateway_Decision')") elementId: String
    ): String {
        requireAdminRole()

        return runWithoutAuthorization {
            val procDef = operatonRepositoryService.findProcessDefinition(
                byKey(processDefinitionKey).and(byLatestVersion())
            ) ?: return@runWithoutAuthorization "Process definition '$processDefinitionKey' not found."

            val bpmnModel = repositoryService.getBpmnModelInstance(procDef.id)
            val element = bpmnModel.getModelElementById<org.operaton.bpm.model.bpmn.instance.FlowElement>(elementId)
                ?: return@runWithoutAuthorization "Element '$elementId' not found in process '${procDef.key}'."

            buildString {
                appendLine("Element: $elementId")
                appendLine("Type: ${element.elementType.typeName}")
                appendLine("Name: ${element.name ?: "(unnamed)"}")

                when (element) {
                    is org.operaton.bpm.model.bpmn.instance.UserTask -> {
                        appendLine("Assignee: ${element.operatonAssignee ?: "N/A"}")
                        appendLine("Candidate Groups: ${element.operatonCandidateGroups ?: "N/A"}")
                        appendLine("Due Date: ${element.operatonDueDate ?: "N/A"}")
                    }
                    is org.operaton.bpm.model.bpmn.instance.ServiceTask -> {
                        appendLine("Implementation: ${element.operatonClass ?: element.operatonExpression ?: element.operatonDelegateExpression ?: "N/A"}")
                    }
                    is org.operaton.bpm.model.bpmn.instance.ExclusiveGateway -> {
                        appendLine("Type: Exclusive Gateway (XOR) - only one outgoing path is taken")
                    }
                    is org.operaton.bpm.model.bpmn.instance.ParallelGateway -> {
                        appendLine("Type: Parallel Gateway (AND) - all outgoing paths are taken simultaneously")
                    }
                    is org.operaton.bpm.model.bpmn.instance.CallActivity -> {
                        appendLine("Called Element: ${element.calledElement}")
                    }
                }

                val documentation = element.documentations.firstOrNull()?.textContent
                if (documentation != null) {
                    appendLine()
                    appendLine("Documentation: $documentation")
                }
            }
        }
    }

    @Tool("""Preview changes to a process definition. Returns a summary of what would change.
        This does NOT deploy the changes - the user must confirm the preview first.""")
    fun previewProcessDefinitionChange(
        @P("The process definition key") processDefinitionKey: String,
        @P("The new BPMN XML content to deploy") newBpmnXml: String,
        @P("Optional: Case definition key to link this process to") caseDefinitionKey: String?
    ): String {
        requireAdminRole()

        val context = ToolContextHolder.get()

        try {
            Bpmn.readModelFromStream(ByteArrayInputStream(newBpmnXml.toByteArray(Charsets.UTF_8)))
        } catch (e: Exception) {
            return "The provided BPMN XML is invalid and cannot be previewed: ${e.message}. " +
                "Fix the XML and call this tool again."
        }

        return runWithoutAuthorization {
            val currentProcDef = operatonRepositoryService.findProcessDefinition(
                byKey(processDefinitionKey).and(byLatestVersion())
            )

            val currentVersion = currentProcDef?.version ?: 0

            val diff = buildString {
                appendLine("Preview of process definition deployment:")
                appendLine()
                appendLine("Process Key: $processDefinitionKey")
                if (currentProcDef != null) {
                    appendLine("Current Version: $currentVersion")
                    appendLine("New Version: ${currentVersion + 1}")
                } else {
                    appendLine("Status: New process definition (first deployment)")
                }
                if (caseDefinitionKey != null) {
                    appendLine("Linked Case Definition: $caseDefinitionKey")
                }
                appendLine("Existing process links and case settings are kept.")
                appendLine()
                appendLine("BPMN Preview (first 500 chars):")
                appendLine(newBpmnXml.take(500))
                if (newBpmnXml.length > 500) {
                    appendLine("... (${newBpmnXml.length - 500} more characters)")
                }
            }

            val currentBpmn = if (currentProcDef != null) {
                try {
                    val bpmnModel = repositoryService.getBpmnModelInstance(currentProcDef.id)
                    Bpmn.convertToString(bpmnModel)
                } catch (e: Exception) {
                    "(current version exists but content unavailable)"
                }
            } else {
                "(new process)"
            }

            val pendingAction = pendingActionService.createPendingAction(
                sessionId = context.sessionId,
                userId = context.userId,
                tool = "apply_process_definition_change",
                params = objectMapper.writeValueAsString(mapOf(
                    "processDefinitionKey" to processDefinitionKey,
                    "bpmnXml" to newBpmnXml,
                    "caseDefinitionKey" to caseDefinitionKey
                )),
                resourceType = "ProcessDefinition",
                resourceId = processDefinitionKey,
                previewDescription = "Deploy process definition '$processDefinitionKey' (v${currentVersion + 1})",
                diffBefore = currentBpmn,
                diffAfter = newBpmnXml,
                affectedResources = listOfNotNull(processDefinitionKey, caseDefinitionKey?.let { "case:$it" })
            )

            "$diff\n\nA confirmation dialog will appear for you to deploy or cancel."
        }
    }

    private fun requireAdminRole() {
        val auth = SecurityContextHolder.getContext().authentication
            ?: throw AccessDeniedException("Not authenticated")

        val hasAdminRole = auth.authorities.any {
            it.authority == "ROLE_ADMIN" || it.authority == "ADMIN"
        }
        if (!hasAdminRole) {
            throw AccessDeniedException("Admin role required for process definition operations")
        }
    }
}
