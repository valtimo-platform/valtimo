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
import com.ritense.externalplugin.repository.ExternalPluginConfigurationRepository
import com.ritense.externalplugin.service.ExternalPluginUserTokenService
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.utils.SecurityUtils
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.server.ResponseStatusException
import java.time.Instant
import java.util.UUID

/**
 * Mints a short-lived, downscoped user token for an external plugin's iframe (via the Angular
 * parent-proxy). Deliberately a **non-management** `/api/v1/...` path so it is *not* ADMIN-gated:
 * any authenticated user may mint one, because the result is always bounded by PBAC ∩ the plugin
 * configuration's granted-endpoint allowlist (system-plan §6.6.1). The minted token never grants
 * more than the requesting user already has.
 */
@Controller
@SkipComponentScan
@RequestMapping("/api/v1/external-plugin", produces = [APPLICATION_JSON_UTF8_VALUE])
class ExternalPluginUserTokenResource(
    private val configurationRepository: ExternalPluginConfigurationRepository,
    private val userTokenService: ExternalPluginUserTokenService,
) {

    /**
     * `@RunWithoutAuthorization` covers the plain configuration-existence read (no PBAC entity). It
     * does **not** affect the minted token: the user's login + roles are read from the still-intact
     * `SecurityContext`, so the result is always bounded by PBAC ∩ allowlist.
     */
    @RunWithoutAuthorization
    @PostMapping("/configuration/{configurationId}/user-token")
    fun mintUserToken(
        @PathVariable configurationId: UUID,
    ): ResponseEntity<UserTokenResponse> {
        val userLogin = SecurityUtils.getCurrentUserLogin()
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "No authenticated user")
        val roles = SecurityUtils.getCurrentUserRoles()

        if (!configurationRepository.existsById(configurationId)) {
            throw ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "External plugin configuration $configurationId not found",
            )
        }

        val issued = userTokenService.issue(userLogin, roles, configurationId)
        return ResponseEntity.ok(UserTokenResponse(issued.token, issued.expiresAt))
    }

    data class UserTokenResponse(
        val userToken: String,
        val expiresAt: Instant,
    )
}
