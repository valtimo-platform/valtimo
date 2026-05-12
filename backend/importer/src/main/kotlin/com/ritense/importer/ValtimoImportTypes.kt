/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.importer

class ValtimoImportTypes {
    companion object {
        // CORE
        const val CASE_DEFINITION = "casedefinition"
        const val CASE_LIST = "caselist"
        const val CASE_TAB = "casetab"
        const val CASE_TAG = "casetag"
        const val CASE_WIDGET_TAB = "casewidgettab"
        const val CASE_TASK_LIST = "casetasklist"
        const val DECISION_DEFINITION = "decisiondefinition"
        const val DOCUMENT_DEFINITION = "documentdefinition"
        const val FORM = "form"
        const val GLOBAL_FORM = "globalform"
        const val FORM_FLOW = "formflow"
        const val INTERNAL_CASE_STATUS = "internalcasestatus"
        const val PROCESS_DEFINITION = "processdefinition"
        const val GLOBAL_PROCESS_DEFINITION = "globalprocessdefinition"
        const val GLOBAL_DECISION_DEFINITION = "globaldecisiondefinition"
        const val PROCESS_DOCUMENT_LINK = "processdocumentlink"
        const val CASE_DEFINITION_PROCESS_LINK = "casedefinitionprocesslink"
        const val PROCESS_LINK = "processlink"
        const val GLOBAL_PROCESS_LINK = "globalprocesslink"
        const val GLOBAL_PERMISSION = "globalpermission"
        const val GLOBAL_ROLE = "globalrole"
        const val SEARCH = "search"
        const val SEARCH_FIELD = "searchField"
        const val CASE_HEADER_WIDGET = "caseheaderwidget"
        const val BUILDING_BLOCK_DEFINITION = "buildingblockdefinition"
        const val BUILDING_BLOCK_PROCESS_DEFINITION = "buildingblockprocessdefinition"
        const val BUILDING_BLOCK_MAIN_PROCESS_DEFINITION = "buildingblockmainprocessdefinition"
        const val BUILDING_BLOCK_DECISION_DEFINITION = "buildingblockdecisiondefinition"
        const val BUILDING_BLOCK_DOCUMENT_DEFINITION = "buildingblockdocumentdefinition"
        const val BUILDING_BLOCK_ARTWORK = "buildingblockartwork"
        const val BUILDING_BLOCK_PROCESS_LINK = "buildingblockprocesslink"
        const val BUILDING_BLOCK_FORM_DEFINITION = "buildingblockformdefinition"
        const val BUILDING_BLOCK_FORM_FLOW_DEFINITION = "buildingblockformflowdefinition"
        const val CASE_BUILDING_BLOCK_LINK = "casebuildingblocklink"
        const val STARTABLE_ITEM = "startableitem"

        const val OBJECT_MANAGEMENT = "objectmanagement"

        // ZGW
        const val ZGW_DOCUMENT_LIST_COLUMN = "zgwdocumentlistcolumn"
        const val ZGW_DOCUMENT_TREFWOORD = "zgwdocumenttrefwoord"
        const val ZGW_DOCUMENT_UPLOAD_FIELD = "zgwdocumentuploadfield"
        const val ZGW_ZAAK_TYPE_LINK = "zgwzaaktypelink"
        const val ZGW_ZAAKDETAIL_SYNC = "zgwzaakdetailsync"
        const val ZGW_ZAKEN_API_SYNC = "zgwzakenapisync"

        // IKO
        const val IKO_REPOSITORY_CONFIG = "ikorepositoryconfig"
        const val IKO_VIEW = "ikoview"
        const val IKO_SEARCH_ACTION = "ikosearchaction"
        const val IKO_SEARCH_FIELD = "ikosearchfield"
        const val IKO_LIST_COLUMN = "ikolistcolumn"
        const val IKO_TAB = "ikotab"
        const val IKO_WIDGET = "ikowidget"

        // TEAM
        const val TEAM = "team"

        // ADMIN SETTINGS
        const val ADMIN_SETTINGS_FEATURE_TOGGLES = "adminsettingsfeaturetoggles"
        const val ADMIN_SETTINGS_ACCENT_COLORS = "adminsettingsaccentcolors"
        const val ADMIN_SETTINGS_LOGO = "adminsettingslogo"
    }
}
