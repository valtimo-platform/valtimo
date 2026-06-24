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

package com.ritense.adminsettings.endpoint

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor

@SkipComponentScan
class AdminSettingsEndpointDescriptionProvider : EndpointDescriptionProvider {

    override fun getEndpointDescriptors(): List<EndpointDescriptor> = listOf(
        endpoint("GET", "/api/management/v1/admin-settings/logo/{logoType}", "Get logo", "Logo ophalen"),
        endpoint("POST", "/api/management/v1/admin-settings/logo/{logoType}", "Upload logo", "Logo uploaden"),
        endpoint("DELETE", "/api/management/v1/admin-settings/logo/{logoType}", "Delete logo", "Logo verwijderen"),
        endpoint("PUT", "/api/management/v1/admin-settings/feature-toggles", "Update feature toggles", "Feature-toggles bijwerken"),
        endpoint("DELETE", "/api/management/v1/admin-settings/feature-toggles/{key}", "Delete feature toggle", "Feature-toggle verwijderen"),
        endpoint("PUT", "/api/management/v1/admin-settings/accent-colors", "Update accent colors", "Accentkleuren bijwerken"),
    )

    private companion object {
        fun endpoint(method: String, pattern: String, en: String, nl: String) =
            EndpointDescriptor(method, pattern, mapOf("en" to en, "nl" to nl))
    }
}
