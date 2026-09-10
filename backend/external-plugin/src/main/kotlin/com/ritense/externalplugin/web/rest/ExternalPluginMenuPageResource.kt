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

import com.ritense.externalplugin.service.ExternalPluginMenuPageService
import com.ritense.externalplugin.web.rest.dto.ExternalPluginMenuPageDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Lists activated external-plugin `page` bundles for the menu-configuration builder. A non-management
 * `/api/v1/...` path gated `.authenticated()` (every admin building the menu can read it); access to
 * the actual page data is enforced at render time by PBAC ∩ the configuration's allowlist via the
 * downscoped user token, so this list is intentionally unfiltered.
 */
@RestController
@SkipComponentScan
@RequestMapping("/api/v1/external-plugin", produces = [APPLICATION_JSON_UTF8_VALUE])
class ExternalPluginMenuPageResource(
    private val menuPageService: ExternalPluginMenuPageService,
) {

    @EndpointDescription(
        en = "List external plugin menu pages",
        nl = "Externe-pluginmenupagina's ophalen",
    )
    @GetMapping("/menu-pages")
    fun getMenuPages(): ResponseEntity<List<ExternalPluginMenuPageDto>> {
        return ResponseEntity.ok(menuPageService.getMenuPages())
    }
}
