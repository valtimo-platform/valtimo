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

package com.ritense.zakenapi.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class ZakenApiEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        endpoint("GET", "/api/management/v1/zaak-type-link/{documentDefinitionName}", "Get zaak type link", "Zaaktypekoppeling ophalen"),
        endpoint("GET", "/api/management/v1/zaak-type-link/process/{processDefinitionKey}", "Get zaak type link by process", "Zaaktypekoppeling ophalen op proces"),
        endpoint("POST", "/api/management/v1/zaak-type-link", "Create zaak type link", "Zaaktypekoppeling aanmaken"),
        endpoint("DELETE", "/api/management/v1/zaak-type-link/{documentDefinitionName}", "Delete zaak type link", "Zaaktypekoppeling verwijderen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/zaak-type-link", "Get zaak type link for case version", "Zaaktypekoppeling voor dossierversie ophalen"),
        endpoint("GET", "/api/management/v1/zaak-type-link/process/{processDefinitionId}", "Get zaak type link by process ID", "Zaaktypekoppeling ophalen op proces-ID"),
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/zaak-type-link", "Create zaak type link for case version", "Zaaktypekoppeling voor dossierversie aanmaken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/zaak-type-link", "Delete zaak type link for case version", "Zaaktypekoppeling voor dossierversie verwijderen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/zaken-api-sync", "Get Zaken API sync settings", "Zaken API-synchronisatie-instellingen ophalen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/zaken-api-sync", "Update Zaken API sync settings", "Zaken API-synchronisatie-instellingen bijwerken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/zaken-api-sync", "Delete Zaken API sync settings", "Zaken API-synchronisatie-instellingen verwijderen"),

        // Case inspection
        endpoint("GET", "/api/management/v1/case/{caseId}/zgw", "Get case ZGW inspection", "ZGW-inspectie voor een dossier ophalen"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
