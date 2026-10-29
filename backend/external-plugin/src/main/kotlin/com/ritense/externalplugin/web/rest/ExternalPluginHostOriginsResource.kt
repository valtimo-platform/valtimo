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

package com.ritense.externalplugin.web.rest

import com.ritense.authorization.annotation.RunWithoutAuthorization
import com.ritense.externalplugin.service.ExternalPluginHostService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import java.net.URI
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Lists the origins (`scheme://host[:port]`) of all registered external-plugin hosts so the frontend
 * can add them to its Content-Security-Policy (`frame-src`/`connect-src`) before inserting the CSP
 * meta tag. A non-management `/api/v1/...` path gated `.authenticated()`: every user who renders a
 * plugin tab, task form or page needs these origins, and an origin exposes no secret — host admin
 * tokens, broker URLs and configuration data remain behind the ADMIN-only management endpoints.
 */
@RestController
@SkipComponentScan
@RequestMapping("/api/v1/external-plugin", produces = [APPLICATION_JSON_UTF8_VALUE])
class ExternalPluginHostOriginsResource(
    private val hostService: ExternalPluginHostService,
) {

    @EndpointDescription(
        en = "List external plugin host origins",
        nl = "Externe-pluginhostorigins ophalen",
    )
    // Same bypass as the management listHosts endpoint: host rows have no PBAC spec; access is
    // gated by the security configurer, and this endpoint only exposes derived origins.
    @RunWithoutAuthorization
    @GetMapping("/host-origins")
    fun getHostOrigins(): ResponseEntity<List<String>> {
        val origins = hostService.list()
            .mapNotNull { originOf(it.baseUrl) }
            .distinct()
            .sorted()
        return ResponseEntity.ok(origins)
    }

    private fun originOf(baseUrl: String): String? {
        val uri = runCatching { URI(baseUrl) }.getOrNull() ?: return null
        val scheme = uri.scheme ?: return null
        val host = uri.host ?: return null
        return if (uri.port == -1) "$scheme://$host" else "$scheme://$host:${uri.port}"
    }
}
