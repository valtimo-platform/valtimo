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

import com.ritense.adminsettings.service.MenuConfigurationService
import com.ritense.adminsettings.web.rest.dto.MenuConfigurationDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import com.ritense.valtimo.contract.endpoint.EndpointDescription
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class MenuConfigurationResource(
    private val menuConfigurationService: MenuConfigurationService
) {

    @EndpointDescription(
        en = "Get the application menu configuration",
        nl = "Menuconfiguratie ophalen",
    )
    @GetMapping("/v1/admin-settings/menu-configuration")
    fun getMenuConfiguration(): ResponseEntity<MenuConfigurationDto> {
        return ResponseEntity.ok(menuConfigurationService.getMenuConfiguration())
    }

    @EndpointDescription(
        en = "Update the application menu configuration",
        nl = "Menuconfiguratie bijwerken",
    )
    @PutMapping("/management/v1/admin-settings/menu-configuration")
    fun updateMenuConfiguration(
        @Valid @RequestBody dto: MenuConfigurationDto
    ): ResponseEntity<MenuConfigurationDto> {
        return ResponseEntity.ok(menuConfigurationService.updateMenuConfiguration(dto.configuration))
    }
}
