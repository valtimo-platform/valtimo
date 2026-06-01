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

package com.ritense.iko.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class IkoEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        // IKO configuration
        endpoint("GET", "/api/management/v1/iko-types", "List IKO types", "IKO-typen ophalen"),
        endpoint("GET", "/api/management/v1/iko-property-fields/{type}/repository-config", "Get IKO property fields for repository config", "IKO-eigenschapsvelden voor repositoryconfiguratie ophalen"),
        endpoint("GET", "/api/management/v1/iko", "List IKO configurations", "IKO-configuraties ophalen"),
        endpoint("GET", "/api/management/v1/iko/{key}", "Get IKO configuration", "IKO-configuratie ophalen"),
        endpoint("POST", "/api/management/v1/iko/{key}", "Create IKO configuration", "IKO-configuratie aanmaken"),
        endpoint("PUT", "/api/management/v1/iko/{key}", "Update IKO configuration", "IKO-configuratie bijwerken"),
        endpoint("DELETE", "/api/management/v1/iko/{key}", "Delete IKO configuration", "IKO-configuratie verwijderen"),

        // IKO view
        endpoint("GET", "/api/management/v1/iko-property-fields/{type}/view", "Get IKO property fields for view", "IKO-eigenschapsvelden voor weergave ophalen"),
        endpoint("GET", "/api/management/v1/iko-view", "List IKO views", "IKO-weergaven ophalen"),
        endpoint("GET", "/api/management/v1/iko-view/{key}", "Get IKO view", "IKO-weergave ophalen"),
        endpoint("POST", "/api/management/v1/iko-view/{key}", "Create IKO view", "IKO-weergave aanmaken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}", "Update IKO view", "IKO-weergave bijwerken"),
        endpoint("DELETE", "/api/management/v1/iko-view/{key}", "Delete IKO view", "IKO-weergave verwijderen"),
        endpoint("GET", "/api/management/v1/iko-view/{key}/export", "Export IKO view", "IKO-weergave exporteren"),
        endpoint("POST", "/api/management/v1/iko-view/import", "Import IKO view", "IKO-weergave importeren"),

        // IKO search action
        endpoint("GET", "/api/management/v1/iko-property-fields/{type}/search-action", "Get IKO property fields for search action", "IKO-eigenschapsvelden voor zoekactie ophalen"),
        endpoint("GET", "/api/management/v1/iko-view/{key}/search-action", "List IKO view search actions", "IKO-weergave-zoekacties ophalen"),
        endpoint("GET", "/api/management/v1/iko-view/{key}/search-action/{key}", "Get IKO view search action", "IKO-weergave-zoekactie ophalen"),
        endpoint("POST", "/api/management/v1/iko-view/{key}/search-action/{key}", "Create IKO view search action", "IKO-weergave-zoekactie aanmaken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}/search-action/{key}", "Update IKO view search action", "IKO-weergave-zoekactie bijwerken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}/search-action", "Update IKO view search actions", "IKO-weergave-zoekacties bijwerken"),
        endpoint("DELETE", "/api/management/v1/iko-view/{key}/search-action/{key}", "Delete IKO view search action", "IKO-weergave-zoekactie verwijderen"),

        // IKO tab
        endpoint("GET", "/api/management/v1/iko-property-fields/{type}/tab", "Get IKO property fields for tab", "IKO-eigenschapsvelden voor tab ophalen"),
        endpoint("GET", "/api/management/v1/iko-view/{key}/tab", "List IKO view tabs", "IKO-weergavetabs ophalen"),
        endpoint("GET", "/api/management/v1/iko-view/{key}/tab/{key}", "Get IKO view tab", "IKO-weergavetab ophalen"),
        endpoint("POST", "/api/management/v1/iko-view/{key}/tab/{key}", "Create IKO view tab", "IKO-weergavetab aanmaken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}/tab/{key}", "Update IKO view tab", "IKO-weergavetab bijwerken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}/tab", "Update IKO view tabs", "IKO-weergavetabs bijwerken"),
        endpoint("DELETE", "/api/management/v1/iko-view/{key}/tab/{key}", "Delete IKO view tab", "IKO-weergavetab verwijderen"),

        // IKO widget
        endpoint("GET", "/api/management/v1/iko-view/{key}/tab/{key}/widget", "List IKO view tab widgets", "IKO-weergavetabwidgets ophalen"),
        endpoint("GET", "/api/management/v1/iko-view/{key}/tab/{key}/widget/{key}", "Get IKO view tab widget", "IKO-weergavetabwidget ophalen"),
        endpoint("POST", "/api/management/v1/iko-view/{key}/tab/{key}/widget/{key}", "Create IKO view tab widget", "IKO-weergavetabwidget aanmaken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}/tab/{key}/widget/{key}", "Update IKO view tab widget", "IKO-weergavetabwidget bijwerken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}/tab/{key}/widget", "Update IKO view tab widgets", "IKO-weergavetabwidgets bijwerken"),
        endpoint("DELETE", "/api/management/v1/iko-view/{key}/tab/{key}/widget/{key}", "Delete IKO view tab widget", "IKO-weergavetabwidget verwijderen"),

        // IKO column
        endpoint("GET", "/api/management/v1/iko-view/{key}/column", "List IKO view columns", "IKO-weergavekolommen ophalen"),
        endpoint("GET", "/api/management/v1/iko-view/{key}/column/{key}", "Get IKO view column", "IKO-weergavekolom ophalen"),
        endpoint("POST", "/api/management/v1/iko-view/{key}/column/{key}", "Create IKO view column", "IKO-weergavekolom aanmaken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}/column/{key}", "Update IKO view column", "IKO-weergavekolom bijwerken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}/column", "Update IKO view columns", "IKO-weergavekolommen bijwerken"),
        endpoint("DELETE", "/api/management/v1/iko-view/{key}/column/{key}", "Delete IKO view column", "IKO-weergavekolom verwijderen"),

        // IKO search field
        endpoint("GET", "/api/management/v1/iko-view/{key}/search-action/{key}/search-field", "List IKO search fields", "IKO-zoekvelden ophalen"),
        endpoint("GET", "/api/management/v1/iko-view/{key}/search-action/{key}/search-field/{key}", "Get IKO search field", "IKO-zoekveld ophalen"),
        endpoint("POST", "/api/management/v1/iko-view/{key}/search-action/{key}/search-field/{key}", "Create IKO search field", "IKO-zoekveld aanmaken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}/search-action/{key}/search-field/{key}", "Update IKO search field", "IKO-zoekveld bijwerken"),
        endpoint("PUT", "/api/management/v1/iko-view/{key}/search-action/{key}/search-field", "Update IKO search fields", "IKO-zoekvelden bijwerken"),
        endpoint("DELETE", "/api/management/v1/iko-view/{key}/search-action/{key}/search-field/{key}", "Delete IKO search field", "IKO-zoekveld verwijderen"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
