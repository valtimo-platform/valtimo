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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.adminsettings.domain.MenuConfiguration
import com.ritense.adminsettings.domain.MenuConfiguration.Companion.SINGLETON_ID
import com.ritense.adminsettings.repository.MenuConfigurationRepository
import com.ritense.adminsettings.web.rest.dto.MenuConfigurationDto
import org.springframework.data.repository.findByIdOrNull
import org.springframework.http.HttpStatus
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

open class MenuConfigurationService(
    private val menuConfigurationRepository: MenuConfigurationRepository,
    private val objectMapper: ObjectMapper,
) {

    @Transactional(readOnly = true)
    open fun getMenuConfiguration(): MenuConfigurationDto {
        val entity = menuConfigurationRepository.findByIdOrNull(SINGLETON_ID)
        val configuration: JsonNode = if (entity != null) {
            objectMapper.readTree(entity.configuration)
        } else {
            objectMapper.createObjectNode()
        }
        return MenuConfigurationDto(configuration)
    }

    @Transactional
    open fun updateMenuConfiguration(configuration: JsonNode): MenuConfigurationDto {
        val serializedConfiguration = objectMapper.writeValueAsString(configuration)
        if (serializedConfiguration.length > MAX_CONFIGURATION_LENGTH) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Menu configuration exceeds the maximum size of $MAX_CONFIGURATION_LENGTH characters"
            )
        }

        val entity = menuConfigurationRepository.findByIdOrNull(SINGLETON_ID)
            ?: MenuConfiguration()

        entity.configuration = serializedConfiguration
        menuConfigurationRepository.save(entity)

        return MenuConfigurationDto(configuration)
    }

    companion object {
        const val MAX_CONFIGURATION_LENGTH = 100_000
    }
}
