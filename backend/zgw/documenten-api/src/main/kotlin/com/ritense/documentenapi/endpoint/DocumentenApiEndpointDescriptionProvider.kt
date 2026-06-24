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

package com.ritense.documentenapi.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class DocumentenApiEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document/trefwoord", "Get ZGW document keywords", "ZGW-documenttrefwoorden ophalen"),
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document/trefwoord/{trefwoord}", "Create ZGW document keyword", "ZGW-documenttrefwoord aanmaken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document/trefwoord/{trefwoord}", "Delete ZGW document keyword", "ZGW-documenttrefwoord verwijderen"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document/trefwoord", "Delete all ZGW document keywords", "Alle ZGW-documenttrefwoorden verwijderen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document-column-key", "Get ZGW document column keys", "ZGW-documentkolomsleutels ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document-column", "Get ZGW document columns", "ZGW-documentkolommen ophalen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document-column", "Update ZGW document columns", "ZGW-documentkolommen bijwerken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document-column/{key}", "Update ZGW document column", "ZGW-documentkolom bijwerken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document-column/{key}", "Delete ZGW document column", "ZGW-documentkolom verwijderen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionName}/documenten-api/version", "Get Documenten API version", "Documenten API-versie ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionName}/version/{caseDefinitionVersionTag}/documenten-api/version", "Get Documenten API version for case version", "Documenten API-versie voor dossierversie ophalen"),
        endpoint("GET", "/api/management/v1/documenten-api/versions", "List Documenten API versions", "Documenten API-versies ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document/upload-field", "Get ZGW document upload fields", "ZGW-documentuploadvelden ophalen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionName}/zgw-document/upload-field", "Update ZGW document upload fields", "ZGW-documentuploadvelden bijwerken"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
