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

package com.ritense.processlink.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class ProcessLinkEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition", "List process definitions for case version", "Procesdefinities voor dossierversie ophalen"),
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition", "Create process definition for case version", "Procesdefinitie voor dossierversie aanmaken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition", "Update process definition for case version", "Procesdefinitie voor dossierversie bijwerken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition/key/{processDefinitionKey}", "Delete process definition for case version", "Procesdefinitie voor dossierversie verwijderen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/process-definition/key/{processDefinitionKey}", "Get process definition for case version", "Procesdefinitie voor dossierversie ophalen"),
        endpoint("GET", "/api/management/v1/process-definition", "List process definitions", "Procesdefinities ophalen"),
        endpoint("GET", "/api/management/v1/process-definition/{processDefinitionId}", "Get process definition", "Procesdefinitie ophalen"),
        endpoint("POST", "/api/management/v1/process-definition", "Create process definition", "Procesdefinitie aanmaken"),
        endpoint("PUT", "/api/management/v1/process-definition", "Update process definition", "Procesdefinitie bijwerken"),
        endpoint("DELETE", "/api/management/v1/process-definition/key/{processDefinitionKey}", "Delete process definition", "Procesdefinitie verwijderen"),
        endpoint("GET", "/api/management/v1/process-definition/key/{processDefinitionKey}", "Get process definition by key", "Procesdefinitie ophalen op sleutel"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
