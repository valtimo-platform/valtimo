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
import com.ritense.case.service.CaseDefinitionService
import com.ritense.document.service.DocumentDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import dev.langchain4j.agent.tool.P
import dev.langchain4j.agent.tool.Tool
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.context.SecurityContextHolder

open class CaseDefinitionTools(
    private val caseDefinitionService: CaseDefinitionService,
    private val documentDefinitionService: DocumentDefinitionService,
    private val pendingActionService: PendingActionService,
    private val objectMapper: ObjectMapper
) {

    @Tool("Get case definition details including settings and schema. Returns JSON with case definition configuration.")
    fun getCaseDefinition(
        @P("The case definition key (e.g., 'loan-application')") caseDefinitionKey: String,
        @P("Optional version tag (e.g., '1.0.0'). If not provided, returns the active version.") versionTag: String?
    ): String {
        requireAdminRole()

        return runWithoutAuthorization {
            val caseDefinition = if (versionTag != null) {
                val caseDefId = CaseDefinitionId(caseDefinitionKey, versionTag)
                caseDefinitionService.getCaseDefinition(caseDefId)
            } else {
                caseDefinitionService.getActiveCaseDefinition(caseDefinitionKey)
                    ?: return@runWithoutAuthorization "Case definition '$caseDefinitionKey' not found or has no active version."
            }

            val documentDefinition = documentDefinitionService.findByNameAndCaseDefinitionId(
                caseDefinitionKey,
                caseDefinition.id
            ).orElse(null)

            buildString {
                appendLine("Case Definition: ${caseDefinition.name}")
                appendLine("Key: ${caseDefinition.id.key}")
                appendLine("Version: ${caseDefinition.id.versionTag}")
                appendLine("Active: ${caseDefinition.active}")
                appendLine("Final: ${caseDefinition.final}")
                appendLine("Description: ${caseDefinition.description ?: "N/A"}")

                if (documentDefinition != null) {
                    appendLine()
                    appendLine("Document Schema:")
                    appendLine(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(
                        documentDefinition.schema()
                    ))
                }
            }
        }
    }

    @Tool("List all case definitions. Returns a list of case definition keys and their status.")
    fun listCaseDefinitions(
        @P("If true, only return active case definitions. Default is true.") activeOnly: Boolean?
    ): String {
        requireAdminRole()

        return runWithoutAuthorization {
            val caseDefinitions = if (activeOnly != false) {
                caseDefinitionService.getCaseDefinitions(active = true)
            } else {
                caseDefinitionService.getCaseDefinitions()
            }

            if (caseDefinitions.isEmpty()) {
                return@runWithoutAuthorization "No case definitions found."
            }

            buildString {
                appendLine("Case Definitions:")
                caseDefinitions.forEach { cd ->
                    appendLine("- ${cd.name} (${cd.id.key}:${cd.id.versionTag}) - active=${cd.active}, final=${cd.final}")
                }
            }
        }
    }

    @Tool("""Preview changes to a case definition. Returns a diff showing what would change.
        This does NOT apply changes - the user must confirm the preview first.
        Use this before any modification to show the user what will happen.""")
    fun previewCaseDefinitionChange(
        @P("The case definition key") caseDefinitionKey: String,
        @P("The version tag of the case definition to modify") versionTag: String,
        @P("JSON describing the changes: {name?: string, description?: string}") changesJson: String
    ): String {
        requireAdminRole()

        val context = ToolContextHolder.get()

        return runWithoutAuthorization {
            val caseDefId = CaseDefinitionId(caseDefinitionKey, versionTag)
            val current = caseDefinitionService.getCaseDefinition(caseDefId)

            if (current.final) {
                return@runWithoutAuthorization "Cannot modify case definition '$caseDefinitionKey:$versionTag' - it is finalized."
            }

            val changes = objectMapper.readTree(changesJson)
            val newName = changes.get("name")?.asText() ?: current.name
            val newDescription = changes.get("description")?.asText() ?: current.description

            val diff = buildString {
                appendLine("Preview of changes to case definition '$caseDefinitionKey:$versionTag':")
                appendLine()
                if (newName != current.name) {
                    appendLine("Name: '${current.name}' -> '$newName'")
                }
                if (newDescription != current.description) {
                    appendLine("Description: '${current.description ?: "(empty)"}' -> '${newDescription ?: "(empty)"}'")
                }
                if (newName == current.name && newDescription == current.description) {
                    appendLine("No changes detected.")
                }
            }

            if (newName == current.name && newDescription == current.description) {
                return@runWithoutAuthorization diff
            }

            val pendingAction = pendingActionService.createPendingAction(
                sessionId = context.sessionId,
                userId = context.userId,
                tool = "apply_case_definition_change",
                params = objectMapper.writeValueAsString(mapOf(
                    "caseDefinitionKey" to caseDefinitionKey,
                    "versionTag" to versionTag,
                    "name" to newName,
                    "description" to newDescription
                )),
                resourceType = "CaseDefinition",
                resourceId = "$caseDefinitionKey:$versionTag"
            )

            "$diff\n\nTo apply these changes, confirm action: ${pendingAction.id}"
        }
    }

    private fun requireAdminRole() {
        val auth = SecurityContextHolder.getContext().authentication
            ?: throw AccessDeniedException("Not authenticated")

        val hasAdminRole = auth.authorities.any {
            it.authority == "ROLE_ADMIN" || it.authority == "ADMIN"
        }
        if (!hasAdminRole) {
            throw AccessDeniedException("Admin role required for case definition operations")
        }
    }
}
