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

package com.ritense.formflow.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class FormFlowEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        endpoint("GET", "/api/management/v1/form-flow-definition/schema", "Get form flow definition schema", "Form-flow-definitieschema ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/process-link-option", "Get form flow process link options", "Form-flow-proceskoppelingsopties ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition", "List form flow definitions", "Form-flow-definities ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/{definitionKey}", "Get form flow definition", "Form-flow-definitie ophalen"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/{definitionKey}", "Delete form flow definition", "Form-flow-definitie verwijderen"),
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition", "Create form flow definition", "Form-flow-definitie aanmaken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-flow-definition/{definitionKey}", "Update form flow definition", "Form-flow-definitie bijwerken"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
