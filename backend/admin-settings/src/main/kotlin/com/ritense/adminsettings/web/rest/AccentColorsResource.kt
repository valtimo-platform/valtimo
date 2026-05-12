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

import com.ritense.adminsettings.service.AccentColorsService
import com.ritense.adminsettings.web.rest.dto.AccentColorsDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.domain.ValtimoMediaType.APPLICATION_JSON_UTF8_VALUE
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@SkipComponentScan
@RequestMapping("/api", produces = [APPLICATION_JSON_UTF8_VALUE])
class AccentColorsResource(
    private val accentColorsService: AccentColorsService
) {

    @GetMapping("/v1/admin-settings/accent-colors")
    fun getColors(): ResponseEntity<AccentColorsDto> {
        return ResponseEntity.ok(accentColorsService.getColors())
    }

    @PutMapping("/management/v1/admin-settings/accent-colors")
    fun updateColors(
        @RequestBody dto: AccentColorsDto
    ): ResponseEntity<AccentColorsDto> {
        return ResponseEntity.ok(accentColorsService.updateColors(dto.colors))
    }
}
