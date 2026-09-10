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

package com.ritense.assistant.executor

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.assistant.service.ActionExecutor
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.form.domain.request.CreateFormDefinitionRequest
import com.ritense.form.domain.request.ModifyFormDefinitionRequest
import com.ritense.form.service.FormDefinitionService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import java.util.UUID

class FormDefinitionActionExecutor(
    private val formDefinitionService: FormDefinitionService,
    private val objectMapper: ObjectMapper
) : ActionExecutor {

    override fun execute(params: String, userId: String): Any {
        val paramsMap = objectMapper.readValue(params, Map::class.java)
        val action = paramsMap["action"] as String

        return when (action) {
            "create" -> executeCreate(paramsMap)
            "modify" -> executeModify(paramsMap)
            "delete" -> executeDelete(paramsMap)
            else -> throw IllegalArgumentException("Unknown form action: $action")
        }
    }

    private fun executeCreate(params: Map<*, *>): Map<String, Any> {
        val caseDefinitionKey = params["caseDefinitionKey"] as String
        val versionTag = params["versionTag"] as String
        val name = params["name"] as String
        val formDefinition = params["formDefinition"] as String
        val readOnly = params["readOnly"] as? Boolean ?: false

        val caseDefId = CaseDefinitionId(caseDefinitionKey, versionTag)
        val request = CreateFormDefinitionRequest(name, formDefinition, readOnly)

        return runWithoutAuthorization {
            val created = formDefinitionService.createFormDefinition(caseDefId, request)
            mapOf(
                "success" to true,
                "message" to "Form created successfully",
                "form" to mapOf(
                    "id" to created.id.toString(),
                    "name" to created.name
                )
            )
        }
    }

    private fun executeModify(params: Map<*, *>): Map<String, Any> {
        val caseDefinitionKey = params["caseDefinitionKey"] as String
        val versionTag = params["versionTag"] as String
        val formId = UUID.fromString(params["formId"] as String)
        val name = params["name"] as? String
        val formDefinition = params["formDefinition"] as? String

        val caseDefId = CaseDefinitionId(caseDefinitionKey, versionTag)
        val request = ModifyFormDefinitionRequest(formId, name, formDefinition)

        return runWithoutAuthorization {
            val updated = formDefinitionService.modifyFormDefinition(caseDefId, request)
            mapOf(
                "success" to true,
                "message" to "Form updated successfully",
                "form" to mapOf(
                    "id" to updated.id.toString(),
                    "name" to updated.name
                )
            )
        }
    }

    private fun executeDelete(params: Map<*, *>): Map<String, Any> {
        val caseDefinitionKey = params["caseDefinitionKey"] as String
        val versionTag = params["versionTag"] as String
        val formId = UUID.fromString(params["formId"] as String)

        val caseDefId = CaseDefinitionId(caseDefinitionKey, versionTag)

        return runWithoutAuthorization {
            formDefinitionService.deleteFormDefinition(caseDefId, formId)
            mapOf(
                "success" to true,
                "message" to "Form deleted successfully",
                "formId" to formId.toString()
            )
        }
    }
}
