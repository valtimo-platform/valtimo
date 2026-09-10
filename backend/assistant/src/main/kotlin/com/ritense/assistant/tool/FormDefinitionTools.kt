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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.assistant.service.PendingActionService
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.form.domain.FormDefinition
import com.ritense.form.service.FormDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import dev.langchain4j.agent.tool.P
import dev.langchain4j.agent.tool.Tool
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.context.SecurityContextHolder
import java.util.UUID

open class FormDefinitionTools(
    private val formDefinitionService: FormDefinitionService,
    private val pendingActionService: PendingActionService,
    private val objectMapper: ObjectMapper
) {

    @Tool("List all forms within a case definition. Returns form names and IDs.")
    fun listForms(
        @P("The case definition key (e.g., 'loan-application')") caseDefinitionKey: String,
        @P("The version tag of the case definition (e.g., '1.0.0')") versionTag: String,
        @P("Optional search term to filter forms by name") searchTerm: String?
    ): String {
        requireAdminRole()

        return runWithoutAuthorization {
            val caseDefId = CaseDefinitionId(caseDefinitionKey, versionTag)
            val forms = formDefinitionService.getFormDefinitions(caseDefId)

            val filtered = if (searchTerm.isNullOrBlank()) {
                forms
            } else {
                forms.filter { it.name.contains(searchTerm, ignoreCase = true) }
            }

            if (filtered.isEmpty()) {
                return@runWithoutAuthorization "No forms found for case definition '$caseDefinitionKey:$versionTag'."
            }

            buildString {
                appendLine("Forms for case definition '$caseDefinitionKey:$versionTag':")
                filtered.forEach { form ->
                    appendLine("- ${form.name} (ID: ${form.id})")
                }
            }
        }
    }

    @Tool("Get form definition details including the FormIO schema. Use this to see a form's structure.")
    fun getFormDefinition(
        @P("The case definition key") caseDefinitionKey: String,
        @P("The version tag of the case definition") versionTag: String,
        @P("The form name or UUID") formIdentifier: String
    ): String {
        requireAdminRole()

        return runWithoutAuthorization {
            val caseDefId = CaseDefinitionId(caseDefinitionKey, versionTag)
            val form = findForm(caseDefId, formIdentifier)
                ?: return@runWithoutAuthorization "Form '$formIdentifier' not found in case definition '$caseDefinitionKey:$versionTag'."

            buildString {
                appendLine("Form: ${form.name}")
                appendLine("ID: ${form.id}")
                appendLine("Read-only: ${form.isReadOnly}")
                appendLine()
                appendLine("FormIO Schema:")
                appendLine(objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(form.formDefinition))
            }
        }
    }

    @Tool("""Preview creating a new form in a case definition.
        The form uses FormIO JSON format for its definition.
        This creates a preview - the user must confirm before the form is actually created.""")
    fun previewCreateForm(
        @P("The case definition key") caseDefinitionKey: String,
        @P("The version tag of the case definition") versionTag: String,
        @P("The name for the new form") formName: String,
        @P("The FormIO JSON schema for the form") formDefinitionJson: String,
        @P("Whether the form should be read-only (default: false)") readOnly: Boolean?
    ): String {
        requireAdminRole()

        val context = ToolContextHolder.get()

        return runWithoutAuthorization {
            val caseDefId = CaseDefinitionId(caseDefinitionKey, versionTag)

            val existingForm = formDefinitionService.getFormDefinitionByName(formName, caseDefId)
            if (existingForm.isPresent) {
                return@runWithoutAuthorization "A form named '$formName' already exists in case definition '$caseDefinitionKey:$versionTag'."
            }

            val formNode = try {
                objectMapper.readTree(formDefinitionJson)
            } catch (e: Exception) {
                return@runWithoutAuthorization "Invalid FormIO JSON: ${e.message}"
            }

            val summary = summarizeFormDefinition(formNode)

            val preview = buildString {
                appendLine("Preview of new form creation:")
                appendLine()
                appendLine("Name: $formName")
                appendLine("Read-only: ${readOnly ?: false}")
                appendLine()
                appendLine("Form structure:")
                appendLine(summary)
            }

            val pendingAction = pendingActionService.createPendingAction(
                sessionId = context.sessionId,
                userId = context.userId,
                tool = "apply_form_definition_change",
                params = objectMapper.writeValueAsString(mapOf(
                    "action" to "create",
                    "caseDefinitionKey" to caseDefinitionKey,
                    "versionTag" to versionTag,
                    "name" to formName,
                    "formDefinition" to formDefinitionJson,
                    "readOnly" to (readOnly ?: false)
                )),
                resourceType = "FormDefinition",
                resourceId = formName,
                previewDescription = "Create form '$formName' in case definition '$caseDefinitionKey:$versionTag'",
                // The frontend renders these as the form itself, so they carry the FormIO
                // schema. The human summary stays in previewDescription and in the reply.
                diffBefore = "(new form)",
                diffAfter = formDefinitionJson,
                affectedResources = listOf("$caseDefinitionKey:$versionTag:$formName")
            )

            "Prepared the new form '$formName'. A confirmation dialog is showing it for review."
        }
    }

    @Tool("""Preview modifying an existing form. Returns a diff showing what would change.
        This does NOT apply changes - the user must confirm the preview first.""")
    fun previewModifyForm(
        @P("The case definition key") caseDefinitionKey: String,
        @P("The version tag of the case definition") versionTag: String,
        @P("The form name or UUID to modify") formIdentifier: String,
        @P("Optional: new name for the form") newName: String?,
        @P("Optional: new FormIO JSON schema") newFormDefinitionJson: String?
    ): String {
        requireAdminRole()

        val context = ToolContextHolder.get()

        return runWithoutAuthorization {
            val caseDefId = CaseDefinitionId(caseDefinitionKey, versionTag)
            val form = findForm(caseDefId, formIdentifier)
                ?: return@runWithoutAuthorization "Form '$formIdentifier' not found in case definition '$caseDefinitionKey:$versionTag'."

            if (form.isReadOnly) {
                return@runWithoutAuthorization "Cannot modify form '${form.name}' - it is read-only."
            }

            if (newName == null && newFormDefinitionJson == null) {
                return@runWithoutAuthorization "No changes specified. Provide either a new name or new form definition."
            }

            val finalName = newName ?: form.name
            val finalDefinitionJson = newFormDefinitionJson ?: objectMapper.writeValueAsString(form.formDefinition)

            if (newFormDefinitionJson != null) {
                try {
                    objectMapper.readTree(newFormDefinitionJson)
                } catch (e: Exception) {
                    return@runWithoutAuthorization "Invalid FormIO JSON: ${e.message}"
                }
            }

            val afterNode = objectMapper.readTree(finalDefinitionJson)

            val diff = buildString {
                appendLine("Preview of changes to form '${form.name}':")
                appendLine()
                if (newName != null && newName != form.name) {
                    appendLine("Name: '${form.name}' -> '$newName'")
                }
                if (newFormDefinitionJson != null) {
                    appendLine("Form definition: updated")
                    appendLine()
                    appendLine("Before:")
                    appendLine(summarizeFormDefinition(form.formDefinition))
                    appendLine()
                    appendLine("After:")
                    appendLine(summarizeFormDefinition(afterNode))
                }
            }

            val pendingAction = pendingActionService.createPendingAction(
                sessionId = context.sessionId,
                userId = context.userId,
                tool = "apply_form_definition_change",
                params = objectMapper.writeValueAsString(mapOf(
                    "action" to "modify",
                    "caseDefinitionKey" to caseDefinitionKey,
                    "versionTag" to versionTag,
                    "formId" to form.id.toString(),
                    "name" to finalName,
                    "formDefinition" to finalDefinitionJson
                )),
                resourceType = "FormDefinition",
                resourceId = "${form.id}",
                previewDescription = "Modify form '${form.name}' in case definition '$caseDefinitionKey:$versionTag'",
                diffBefore = objectMapper.writeValueAsString(form.formDefinition),
                diffAfter = finalDefinitionJson,
                affectedResources = listOf("$caseDefinitionKey:$versionTag:${form.name}")
            )

            // A rename is not visible in the rendered diff, since the name is not part of
            // the FormIO schema, so it has to be said here.
            val renamed = if (finalName != form.name) " It will be renamed to '$finalName'." else ""

            "Prepared the changes to form '${form.name}'.$renamed A confirmation dialog is showing them for review."
        }
    }

    @Tool("""Preview deleting a form. Shows what will be deleted for user confirmation.
        This does NOT delete - the user must confirm first.""")
    fun previewDeleteForm(
        @P("The case definition key") caseDefinitionKey: String,
        @P("The version tag of the case definition") versionTag: String,
        @P("The form name or UUID to delete") formIdentifier: String
    ): String {
        requireAdminRole()

        val context = ToolContextHolder.get()

        return runWithoutAuthorization {
            val caseDefId = CaseDefinitionId(caseDefinitionKey, versionTag)
            val form = findForm(caseDefId, formIdentifier)
                ?: return@runWithoutAuthorization "Form '$formIdentifier' not found in case definition '$caseDefinitionKey:$versionTag'."

            if (form.isReadOnly) {
                return@runWithoutAuthorization "Cannot delete form '${form.name}' - it is read-only."
            }

            val summary = summarizeFormDefinition(form.formDefinition)

            val preview = buildString {
                appendLine("Preview of form deletion:")
                appendLine()
                appendLine("Form to delete: ${form.name}")
                appendLine("ID: ${form.id}")
                appendLine()
                appendLine("Form structure:")
                appendLine(summary)
            }

            val pendingAction = pendingActionService.createPendingAction(
                sessionId = context.sessionId,
                userId = context.userId,
                tool = "apply_form_definition_change",
                params = objectMapper.writeValueAsString(mapOf(
                    "action" to "delete",
                    "caseDefinitionKey" to caseDefinitionKey,
                    "versionTag" to versionTag,
                    "formId" to form.id.toString()
                )),
                resourceType = "FormDefinition",
                resourceId = "${form.id}",
                previewDescription = "Delete form '${form.name}' from case definition '$caseDefinitionKey:$versionTag'",
                diffBefore = objectMapper.writeValueAsString(form.formDefinition),
                diffAfter = "(deleted)",
                affectedResources = listOf("$caseDefinitionKey:$versionTag:${form.name}")
            )

            "Prepared the deletion of form '${form.name}'. A confirmation dialog is showing it for review."
        }
    }

    private fun findForm(caseDefId: CaseDefinitionId, formIdentifier: String): FormDefinition? {
        return try {
            val uuid = UUID.fromString(formIdentifier)
            formDefinitionService.getFormDefinitionById(caseDefId, uuid).orElse(null)
        } catch (e: IllegalArgumentException) {
            formDefinitionService.getFormDefinitionByName(formIdentifier, caseDefId).orElse(null)
        }
    }

    private fun summarizeFormDefinition(formDefinition: JsonNode): String {
        val components = formDefinition.get("components") ?: return "No components defined"

        return buildString {
            val fieldNames = mutableListOf<String>()
            collectFieldNames(components, fieldNames)

            appendLine("Components: ${countComponents(components)}")
            if (fieldNames.isNotEmpty()) {
                appendLine("Fields: ${fieldNames.joinToString(", ")}")
            }
        }
    }

    private fun countComponents(node: JsonNode): Int {
        if (!node.isArray) return 0
        var count = node.size()
        node.forEach { component ->
            component.get("components")?.let { count += countComponents(it) }
            component.get("columns")?.forEach { col ->
                col.get("components")?.let { count += countComponents(it) }
            }
        }
        return count
    }

    private fun collectFieldNames(node: JsonNode, fieldNames: MutableList<String>) {
        if (!node.isArray) return
        node.forEach { component ->
            component.get("key")?.asText()?.let { key ->
                if (key.isNotBlank() && !key.startsWith("column") && !key.startsWith("panel")) {
                    fieldNames.add(key)
                }
            }
            component.get("components")?.let { collectFieldNames(it, fieldNames) }
            component.get("columns")?.forEach { col ->
                col.get("components")?.let { collectFieldNames(it, fieldNames) }
            }
        }
    }

    private fun requireAdminRole() {
        val auth = SecurityContextHolder.getContext().authentication
            ?: throw AccessDeniedException("Not authenticated")

        val hasAdminRole = auth.authorities.any {
            it.authority == "ROLE_ADMIN" || it.authority == "ADMIN"
        }
        if (!hasAdminRole) {
            throw AccessDeniedException("Admin role required for form definition operations")
        }
    }
}
