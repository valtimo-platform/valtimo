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

package com.ritense.case.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class CaseEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        // Document endpoints
        endpoint("GET", "/api/v1/document/{id}", "Retrieve a document by ID", "Document ophalen op ID"),
        endpoint("DELETE", "/api/v1/document/{id}", "Delete a document by ID", "Document verwijderen op ID"),
        endpoint("POST", "/api/v1/document", "Create a document", "Document aanmaken"),
        endpoint("PUT", "/api/v1/document", "Update a document", "Document bijwerken"),
        endpoint("POST", "/api/v1/document/{document-id}/resource/{resource-id}", "Link resource to document", "Bron aan document koppelen"),
        endpoint("DELETE", "/api/v1/document/{document-id}/resource/{resource-id}", "Unlink resource from document", "Bron van document ontkoppelen"),
        endpoint("POST", "/api/v1/document/{documentId}/assign", "Assign a document", "Document toewijzen"),
        endpoint("POST", "/api/v1/document/assign", "Bulk assign documents", "Documenten in bulk toewijzen"),
        endpoint("POST", "/api/v1/document/{documentId}/unassign", "Unassign a document", "Documenttoewijzing opheffen"),
        endpoint("GET", "/api/v1/document/{document-id}/candidate-user", "Get candidate users for document", "Kandidaat-gebruikers voor document ophalen"),
        endpoint("POST", "/api/v1/document/candidate-user", "Get candidate users for documents", "Kandidaat-gebruikers voor documenten ophalen"),
        endpoint("GET", "/api/v1/document/{document-id}/candidate-team", "Get candidate teams for document", "Kandidaat-teams voor document ophalen"),
        endpoint("POST", "/api/v1/document-search", "Search documents", "Documenten zoeken"),
        endpoint("POST", "/api/v1/document-definition/{name}/search", "Search documents by definition", "Documenten zoeken op definitie"),

        // Document definition management
        endpoint("POST", "/api/management/v1/document-definition-template", "Create document definition from template", "Documentdefinitie aanmaken vanuit sjabloon"),
        endpoint("GET", "/api/management/v1/document-definition", "List document definitions", "Documentdefinities ophalen"),
        endpoint("GET", "/api/management/v1/document-definition/{name}", "Get document definition", "Documentdefinitie ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/document-definition", "Get document definition for case version", "Documentdefinitie voor dossierversie ophalen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{versionTag}/document-definition", "Update document definition for case version", "Documentdefinitie voor dossierversie bijwerken"),
        endpoint("GET", "/api/management/v1/document-definition/{name}/version", "List document definition versions", "Documentdefinitieversies ophalen"),
        endpoint("POST", "/api/management/v1/document-definition", "Create a document definition", "Documentdefinitie aanmaken"),
        endpoint("DELETE", "/api/management/v1/document-definition/{name}", "Delete a document definition", "Documentdefinitie verwijderen"),

        // Document search management
        endpoint("GET", "/api/management/v1/document-search/{documentDefinitionName}/fields", "Get document search fields", "Documentzoekvelden ophalen"),

        // Document migration
        endpoint("POST", "/api/management/v1/document-definition/migration/conflicts", "Check document migration conflicts", "Documentmigratieconflicten controleren"),
        endpoint("POST", "/api/management/v1/document-definition/migrate", "Migrate document definitions", "Documentdefinities migreren"),

        // Internal case status management
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionName}/internal-status", "List internal case statuses", "Interne dossierstatussen ophalen"),
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionName}/internal-status", "Create internal case status", "Interne dossierstatus aanmaken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionName}/internal-status", "Update internal case statuses", "Interne dossierstatussen bijwerken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionName}/internal-status/{internalStatusKey}", "Update internal case status", "Interne dossierstatus bijwerken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionName}/internal-status/{internalStatusKey}", "Delete internal case status", "Interne dossierstatus verwijderen"),

        // Case tag management
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/case-tag", "List case tags", "Dossiertags ophalen"),
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/case-tag", "Create a case tag", "Dossiertag aanmaken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/case-tag", "Update case tags", "Dossiertags bijwerken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/case-tag/{caseTagKey}", "Update a case tag", "Dossiertag bijwerken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/case-tag/{caseTagKey}", "Delete a case tag", "Dossiertag verwijderen"),

        // Case definition management
        endpoint("GET", "/api/management/v1/case-definition", "List case definitions", "Dossierdefinities ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionName}/version", "List case definition versions", "Dossierdefinitieversies ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/configuration-issues", "Get configuration issues", "Configuratieproblemen ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/dangling-plugin-configurations", "Get dangling plugin configurations", "Ontkoppelde pluginconfiguraties ophalen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/plugin-configuration-mappings", "Update plugin configuration mappings", "Pluginconfiguratiemappings bijwerken"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/settings", "Get case definition settings", "Dossierdefinitie-instellingen ophalen"),
        endpoint("PATCH", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/settings", "Update case definition settings", "Dossierdefinitie-instellingen bijwerken"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}", "Get case definition", "Dossierdefinitie ophalen"),
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/active", "Activate case definition version", "Dossierdefinitieversie activeren"),
        endpoint("GET", "/api/management/v1/case-definition/{key}/version/{version}", "Get case definition version", "Dossierdefinitieversie ophalen"),
        endpoint("DELETE", "/api/management/v1/case-definition/{key}/version/{version}", "Delete case definition version", "Dossierdefinitieversie verwijderen"),
        endpoint("PATCH", "/api/management/v1/case-definition/{key}/version/{version}", "Patch case definition version", "Dossierdefinitieversie gedeeltelijk bijwerken"),
        endpoint("POST", "/api/management/v1/case-definition/draft", "Create draft case definition", "Conceptdossierdefinitie aanmaken"),
        endpoint("POST", "/api/management/v1/case-definition/{key}/version/{version}/finalize", "Finalize case definition version", "Dossierdefinitieversie afronden"),
        endpoint("GET", "/api/management/v1/case-definition/{key}/version/{version}/finalizable", "Check if case definition is finalizable", "Controleren of dossierdefinitie afgerond kan worden"),
        endpoint("GET", "/api/management/v1/case-definition/check", "Check case definitions", "Dossierdefinities controleren"),

        // List column management
        endpoint("GET", "/api/management/v1/case/{caseDefinitionName}/list-column", "Get case list columns", "Dossierlijstkolommen ophalen"),
        endpoint("POST", "/api/management/v1/case/{caseDefinitionName}/list-column", "Create case list column", "Dossierlijstkolom aanmaken"),
        endpoint("PUT", "/api/management/v1/case/{caseDefinitionName}/list-column", "Update case list columns", "Dossierlijstkolommen bijwerken"),
        endpoint("DELETE", "/api/management/v1/case/{caseDefinitionName}/list-column/{columnKey}", "Delete case list column", "Dossierlijstkolom verwijderen"),

        // Task list column management
        endpoint("GET", "/api/management/v1/case/{caseDefinitionName}/task-list-column", "Get task list columns", "Taaklijstkolommen ophalen"),
        endpoint("POST", "/api/management/v1/case/{caseDefinitionName}/task-list-column", "Create task list column", "Taaklijstkolom aanmaken"),
        endpoint("POST", "/api/management/v2/case/{caseDefinitionName}/task-list-column", "Create task list column (v2)", "Taaklijstkolom aanmaken (v2)"),
        endpoint("PUT", "/api/management/v1/case/{caseDefinitionName}/task-list-column/{columnKey}", "Update task list column", "Taaklijstkolom bijwerken"),
        endpoint("DELETE", "/api/management/v1/case/{caseDefinitionName}/task-list-column/{columnKey}", "Delete task list column", "Taaklijstkolom verwijderen"),

        // Tab management
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/tab", "Create a case tab", "Dossiertab aanmaken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/tab", "Update case tabs", "Dossiertabs bijwerken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/tab/{tabKey}", "Update a case tab", "Dossiertab bijwerken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/tab/{tabKey}", "Delete a case tab", "Dossiertab verwijderen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/tab/{tabKey}", "Get a case tab", "Dossiertab ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/tab", "List case tabs", "Dossiertabs ophalen"),

        // Widget tab management
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/widget-tab/{tabKey}", "Get widget tab", "Widgettab ophalen"),
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/widget-tab/{tabKey}", "Create widget tab", "Widgettab aanmaken"),
        endpoint("GET", "/api/management/v1/metroline/available-modes", "Get available metroline modes", "Beschikbare metroline-modi ophalen"),

        // Header widget management
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/header-widget", "Create header widget", "Headerwidget aanmaken"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/header-widget", "Get header widget", "Headerwidget ophalen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/header-widget", "Update header widget", "Headerwidget bijwerken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/header-widget", "Delete header widget", "Headerwidget verwijderen"),

        // Startable item management
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item", "List startable items", "Startbare items ophalen"),
        endpoint("POST", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item", "Create a startable item", "Startbaar item aanmaken"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item/{itemKey}/version/{versionTag}", "Delete startable item version", "Versie van startbaar item verwijderen"),
        endpoint("DELETE", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item/{itemKey}", "Delete a startable item", "Startbaar item verwijderen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item/order", "Update startable item order", "Volgorde startbare items bijwerken"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item/{itemKey}/version/{versionTag}/properties", "Get startable item version properties", "Eigenschappen van versie van startbaar item ophalen"),
        endpoint("GET", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item/{itemKey}/properties", "Get startable item properties", "Eigenschappen van startbaar item ophalen"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item/{itemKey}/version/{versionTag}", "Update startable item version", "Versie van startbaar item bijwerken"),
        endpoint("PUT", "/api/management/v1/case-definition/{caseDefinitionKey}/version/{caseDefinitionVersionTag}/startable-item/{itemKey}", "Update a startable item", "Startbaar item bijwerken"),

        // Export/import
        endpoint("GET", "/api/management/v1/case/{caseDefinitionName}/version/{caseDefinitionVersion}/export", "Export case definition", "Dossierdefinitie exporteren"),
        endpoint("POST", "/api/management/v1/case/import", "Import case definition", "Dossierdefinitie importeren"),
        endpoint("POST", "/api/management/v1/case/import/preview", "Preview case definition import", "Importvoorvertoning van dossierdefinitie"),

        // Case inspection
        endpoint("GET", "/api/management/v1/case/{caseId}", "Get a case for inspection", "Dossier voor inspectie ophalen"),
        endpoint("PUT", "/api/management/v1/case/{caseId}", "Modify a case for inspection", "Dossier voor inspectie bijwerken"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
