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

package com.ritense.adminsettings.service

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.adminsettings.domain.AccentColors
import com.ritense.adminsettings.repository.AccentColorsRepository
import com.ritense.adminsettings.web.rest.dto.AccentColorsDto
import org.springframework.data.repository.findByIdOrNull
import org.springframework.transaction.annotation.Transactional

open class AccentColorsService(
    private val accentColorsRepository: AccentColorsRepository,
    private val objectMapper: ObjectMapper,
) {

    @Transactional(readOnly = true)
    open fun getColors(): AccentColorsDto {
        val entity = accentColorsRepository.findByIdOrNull("singleton")
        val colors: Map<String, String> = if (entity != null) {
            objectMapper.readValue(entity.colors, object : TypeReference<Map<String, String>>() {})
        } else {
            emptyMap()
        }
        return AccentColorsDto(colors)
    }

    @Transactional
    open fun updateColors(colors: Map<String, String>): AccentColorsDto {
        val entity = accentColorsRepository.findByIdOrNull("singleton")
            ?: AccentColors()

        entity.colors = objectMapper.writeValueAsString(colors)
        accentColorsRepository.save(entity)

        return AccentColorsDto(colors)
    }
}
