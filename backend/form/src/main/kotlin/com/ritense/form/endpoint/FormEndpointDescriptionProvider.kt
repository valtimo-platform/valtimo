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

package com.ritense.form.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class FormEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        endpoint("GET", "/api/management/v1/form-option", "List form options", "Formulieropties ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form-option", "Get form options for case version", "Formulieropties voor dossierversie ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form", "List forms for case version", "Formulieren voor dossierversie ophalen"),
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form", "Create form for case version", "Formulier voor dossierversie aanmaken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form", "Update form for case version", "Formulier voor dossierversie bijwerken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form/{formDefinitionId}", "Delete form for case version", "Formulier voor dossierversie verwijderen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form/{formDefinitionId}", "Get form for case version", "Formulier voor dossierversie ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/form/{name}/exists", "Check if form exists for case version", "Controleren of formulier bestaat voor dossierversie"),
        endpoint("GET", "/api/management/v1/form", "List form definitions", "Formulierdefinities ophalen"),
        endpoint("GET", "/api/management/v1/form/{formDefinitionId}", "Get form definition", "Formulierdefinitie ophalen"),
        endpoint("POST", "/api/management/v1/form", "Create form definition", "Formulierdefinitie aanmaken"),
        endpoint("PUT", "/api/management/v1/form", "Update form definition", "Formulierdefinitie bijwerken"),
        endpoint("DELETE", "/api/management/v1/form/{formDefinitionId}", "Delete form definition", "Formulierdefinitie verwijderen"),
        endpoint("GET", "/api/management/v1/form/exists/{name}", "Check if form definition exists", "Controleren of formulierdefinitie bestaat"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
