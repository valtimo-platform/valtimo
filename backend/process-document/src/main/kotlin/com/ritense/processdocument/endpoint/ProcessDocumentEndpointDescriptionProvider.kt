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

package com.ritense.processdocument.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class ProcessDocumentEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/feature-process/{type}", "Get feature process", "Featureproces ophalen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/feature-process", "Update feature process", "Featureproces bijwerken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/feature-process/{type}", "Delete feature process", "Featureproces verwijderen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/process/{processDefinitionId}/properties", "Update process properties", "Proceseigenschappen bijwerken"),

        // Case inspection
        endpoint("GET", "/api/management/v1/case/{caseId}/processes", "List process instances for a case", "Procesinstanties voor een dossier ophalen"),
        endpoint("POST", "/api/management/v1/case/{caseId}/process-instance/{processInstanceId}/variables", "Create a process variable", "Procesvariabele aanmaken"),
        endpoint("PUT", "/api/management/v1/case/{caseId}/process-instance/{processInstanceId}/variables/{name}", "Update a process variable", "Procesvariabele bijwerken"),
        endpoint("DELETE", "/api/management/v1/case/{caseId}/process-instance/{processInstanceId}/variables/{name}", "Delete a process variable", "Procesvariabele verwijderen"),
        endpoint("POST", "/api/management/v1/case/{caseId}/logs", "Search case logs", "Dossierlogboeken doorzoeken"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
