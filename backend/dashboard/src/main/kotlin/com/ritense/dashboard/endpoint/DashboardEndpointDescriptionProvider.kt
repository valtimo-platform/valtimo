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

package com.ritense.dashboard.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class DashboardEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        endpoint("GET", "/api/management/v1/dashboard", "List dashboards", "Dashboards ophalen"),
        endpoint("GET", "/api/management/v1/dashboard/{dashboardKey}", "Get dashboard", "Dashboard ophalen"),
        endpoint("POST", "/api/management/v1/dashboard", "Create a dashboard", "Dashboard aanmaken"),
        endpoint("PUT", "/api/management/v1/dashboard", "Update dashboards", "Dashboards bijwerken"),
        endpoint("DELETE", "/api/management/v1/dashboard/{dashboard-key}", "Delete a dashboard", "Dashboard verwijderen"),
        endpoint("PUT", "/api/management/v1/dashboard/{dashboard-key}", "Update a dashboard", "Dashboard bijwerken"),
        endpoint("GET", "/api/management/v1/dashboard/{dashboardKey}/widget-configuration", "List widget configurations", "Widgetconfiguraties ophalen"),
        endpoint("POST", "/api/management/v1/dashboard/{dashboardKey}/widget-configuration", "Create widget configuration", "Widgetconfiguratie aanmaken"),
        endpoint("PUT", "/api/management/v1/dashboard/{dashboardKey}/widget-configuration", "Update widget configurations", "Widgetconfiguraties bijwerken"),
        endpoint("GET", "/api/management/v1/dashboard/{dashboardKey}/widget-configuration/{widgetKey}", "Get widget configuration", "Widgetconfiguratie ophalen"),
        endpoint("PUT", "/api/management/v1/dashboard/{dashboardKey}/widget-configuration/{widgetKey}", "Update widget configuration", "Widgetconfiguratie bijwerken"),
        endpoint("DELETE", "/api/management/v1/dashboard/{dashboardKey}/widget-configuration/{widgetKey}", "Delete widget configuration", "Widgetconfiguratie verwijderen"),
        endpoint("GET", "/api/management/v1/dashboard/widget-data-sources", "List widget data sources", "Widgetdatabronnen ophalen"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
