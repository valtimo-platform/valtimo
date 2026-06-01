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

package com.ritense.buildingblock.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class BuildingBlockEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        endpoint("GET", "/api/management/v1/building-block", "List building blocks", "Bouwblokken ophalen"),
        endpoint("POST", "/api/management/v1/building-block", "Create a building block", "Bouwblok aanmaken"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version", "List building block versions", "Bouwblokversies ophalen"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}", "Get building block version", "Bouwblokversie ophalen"),
        endpoint("PUT", "/api/management/v1/building-block/{key}/version/{versionTag}", "Update building block version", "Bouwblokversie bijwerken"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/document", "Get building block document schema", "Bouwblokdocumentschema ophalen"),
        endpoint("PUT", "/api/management/v1/building-block/{key}/version/{versionTag}/document", "Update building block document schema", "Bouwblokdocumentschema bijwerken"),
        endpoint("POST", "/api/management/v1/building-block/{key}/version/{versionTag}/draft", "Create draft from building block", "Concept van bouwblok aanmaken"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/export", "Export building block", "Bouwblok exporteren"),
        endpoint("POST", "/api/management/v1/building-block/{key}/version/{versionTag}/finalize", "Finalize building block", "Bouwblok afronden"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/plugin", "Get building block plugins", "Bouwblokplugins ophalen"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/fields", "Get building block fields", "Bouwblokvelden ophalen"),
        endpoint("GET", "/api/management/v1/building-block/process-definition/{processDefinitionId}/is-building-block", "Check if process is a building block", "Controleren of proces een bouwblok is"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/process-definition", "List building block process definitions", "Bouwblokprocesdefinities ophalen"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/process-definition/{processDefinitionId}", "Get building block process definition", "Bouwblokprocesdefinitie ophalen"),
        endpoint("POST", "/api/management/v1/building-block/{key}/version/{versionTag}/process-definition", "Add process definition to building block", "Procesdefinitie aan bouwblok toevoegen"),
        endpoint("PUT", "/api/management/v1/building-block/{key}/version/{versionTag}/process-definition/{processDefinitionId}", "Update building block process definition", "Bouwblokprocesdefinitie bijwerken"),
        endpoint("POST", "/api/management/v1/building-block/import", "Import building block", "Bouwblok importeren"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/artwork", "Get building block artwork", "Bouwblokafbeelding ophalen"),
        endpoint("POST", "/api/management/v1/building-block/{key}/version/{versionTag}/artwork", "Upload building block artwork", "Bouwblokafbeelding uploaden"),
        endpoint("DELETE", "/api/management/v1/building-block/{key}/version/{versionTag}/artwork", "Delete building block artwork", "Bouwblokafbeelding verwijderen"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/process-definition/main/key", "Get main process definition key", "Hoofdprocesdefinitie-sleutel ophalen"),
        endpoint("POST", "/api/management/v1/building-block/{key}/version/{versionTag}/process-definition/{processDefinitionId}/main", "Set main process definition", "Hoofdprocesdefinitie instellen"),
        endpoint("DELETE", "/api/management/v1/building-block/{key}/version/{versionTag}/process-definition/{processDefinitionId}", "Remove process definition from building block", "Procesdefinitie van bouwblok verwijderen"),
        endpoint("POST", "/api/management/v1/value-resolver/building-block/{key}/version/{versionTag}/keys", "Resolve value keys for building block", "Value-sleutels voor bouwblok ophalen"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/form-option", "Get building block form options", "Bouwblokformulieropties ophalen"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/form", "List building block forms", "Bouwblokformulieren ophalen"),
        endpoint("POST", "/api/management/v1/building-block/{key}/version/{versionTag}/form", "Create building block form", "Bouwblokformulier aanmaken"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/form/{formDefinitionId}", "Get building block form", "Bouwblokformulier ophalen"),
        endpoint("PUT", "/api/management/v1/building-block/{key}/version/{versionTag}/form/{formDefinitionId}", "Update building block form", "Bouwblokformulier bijwerken"),
        endpoint("DELETE", "/api/management/v1/building-block/{key}/version/{versionTag}/form/{formDefinitionId}", "Delete building block form", "Bouwblokformulier verwijderen"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/form/name/{name}", "Get building block form by name", "Bouwblokformulier ophalen op naam"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/form/{name}/exists", "Check if building block form exists", "Controleren of bouwblokformulier bestaat"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/form-flow-definition", "List building block form flow definitions", "Bouwblok-form-flow-definities ophalen"),
        endpoint("POST", "/api/management/v1/building-block/{key}/version/{versionTag}/form-flow-definition", "Create building block form flow definition", "Bouwblok-form-flow-definitie aanmaken"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/form-flow-definition/{definitionKey}", "Get building block form flow definition", "Bouwblok-form-flow-definitie ophalen"),
        endpoint("PUT", "/api/management/v1/building-block/{key}/version/{versionTag}/form-flow-definition/{definitionKey}", "Update building block form flow definition", "Bouwblok-form-flow-definitie bijwerken"),
        endpoint("DELETE", "/api/management/v1/building-block/{key}/version/{versionTag}/form-flow-definition/{definitionKey}", "Delete building block form flow definition", "Bouwblok-form-flow-definitie verwijderen"),
        endpoint("GET", "/api/management/v1/building-block/{key}/version/{versionTag}/decision-definition", "List building block decision definitions", "Bouwblokbeslisdefinities ophalen"),
        endpoint("POST", "/api/management/v1/building-block/{key}/version/{versionTag}/decision-definition", "Create building block decision definition", "Bouwblokbeslisdefinitie aanmaken"),
        endpoint("DELETE", "/api/management/v1/building-block/{key}/version/{versionTag}/decision-definition/{decisionDefinitionKey}", "Delete building block decision definition", "Bouwblokbeslisdefinitie verwijderen"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
