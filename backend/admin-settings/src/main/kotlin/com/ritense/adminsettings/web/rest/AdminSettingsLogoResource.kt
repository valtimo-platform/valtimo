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

package com.ritense.adminsettings.web.rest

import com.ritense.adminsettings.domain.LogoType
import com.ritense.adminsettings.service.AdminSettingsLogoService
import com.ritense.adminsettings.web.rest.dto.AdminSettingsLogoDto
import com.ritense.adminsettings.web.rest.dto.AdminSettingsLogosDto
import com.ritense.adminsettings.web.rest.dto.CreateAdminSettingsLogoDto
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class AdminSettingsLogoResource(
    private val adminSettingsLogoService: AdminSettingsLogoService
) {

    @EndpointDescription(
        en = "List logos",
        nl = "Logo's ophalen",
    )
    @GetMapping("/v1/admin-settings/logos")
    fun getLogos(): ResponseEntity<AdminSettingsLogosDto> {
        val logos = adminSettingsLogoService.getLogos()
        return ResponseEntity.ok(logos)
    }

    @EndpointDescription(
        en = "Get logo by type",
        nl = "Logo ophalen op type",
    )
    @GetMapping("/management/v1/admin-settings/logo/{logoType}")
    fun getLogo(
        @PathVariable logoType: LogoType
    ): ResponseEntity<AdminSettingsLogoDto> {
        val dto = adminSettingsLogoService.getLogo(logoType)
        return dto?.let { ResponseEntity.ok(it) }
            ?: ResponseEntity.notFound().build()
    }

    @EndpointDescription(
        en = "Upload logo by type",
        nl = "Logo uploaden op type",
    )
    @PostMapping(
        path = ["/management/v1/admin-settings/logo/{logoType}"],
        consumes = [APPLICATION_JSON_UTF8_VALUE]
    )
    fun uploadLogo(
        @PathVariable logoType: LogoType,
        @Valid @RequestBody dto: CreateAdminSettingsLogoDto
    ): ResponseEntity<AdminSettingsLogoDto> {
        val created = runWithoutAuthorization { adminSettingsLogoService.uploadLogo(logoType, dto) }
        return ResponseEntity.ok(created)
    }

    @EndpointDescription(
        en = "Delete logo by type",
        nl = "Logo verwijderen op type",
    )
    @DeleteMapping("/management/v1/admin-settings/logo/{logoType}")
    fun deleteLogo(
        @PathVariable logoType: LogoType
    ): ResponseEntity<Void> {
        runWithoutAuthorization { adminSettingsLogoService.deleteLogo(logoType) }
        return ResponseEntity.noContent().build()
    }
}
