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

package com.ritense.zaakdetails.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class ZaakDetailsEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/objecten-api-sync", "Get Objecten API sync settings", "Objecten API-synchronisatie-instellingen ophalen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/objecten-api-sync", "Update Objecten API sync settings", "Objecten API-synchronisatie-instellingen bijwerken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/objecten-api-sync", "Delete Objecten API sync settings", "Objecten API-synchronisatie-instellingen verwijderen"),

        // Case inspection
        endpoint("GET", "/api/management/v1/case/{caseId}/zgw/zaakdetails", "Get case zaakdetails inspection", "Zaakdetails-inspectie voor een dossier ophalen"),
        endpoint("GET", "/api/management/v1/case/{caseId}/zgw/zaakdetails/object", "Get case zaakdetails object content", "Zaakdetails-objectinhoud voor een dossier ophalen"),
        endpoint("GET", "/api/management/v1/case/{caseId}/zgw/zaakobject/resolve", "Resolve zaakobject content for a case", "Zaakobjectinhoud voor een dossier oplossen"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
