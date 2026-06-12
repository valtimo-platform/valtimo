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
import com.ritense.adminsettings.domain.FeatureToggleOverrides
import com.ritense.adminsettings.repository.FeatureToggleOverridesRepository
import com.ritense.adminsettings.web.rest.dto.FeatureToggleOverridesDto
import org.springframework.data.repository.findByIdOrNull
import org.springframework.transaction.annotation.Transactional

open class FeatureToggleOverridesService(
    private val featureToggleOverridesRepository: FeatureToggleOverridesRepository,
    private val objectMapper: ObjectMapper,
) {

    @Transactional(readOnly = true)
    open fun getOverrides(): FeatureToggleOverridesDto {
        val entity = featureToggleOverridesRepository.findByIdOrNull("singleton")
        val overrides: Map<String, Boolean> = if (entity != null) {
            objectMapper.readValue(entity.overrides, object : TypeReference<Map<String, Boolean>>() {})
        } else {
            emptyMap()
        }
        return FeatureToggleOverridesDto(overrides)
    }

    @Transactional
    open fun updateToggle(key: String, enabled: Boolean): FeatureToggleOverridesDto {
        val entity = featureToggleOverridesRepository.findByIdOrNull("singleton")
            ?: FeatureToggleOverrides()

        val currentOverrides: MutableMap<String, Boolean> = objectMapper.readValue(
            entity.overrides, object : TypeReference<MutableMap<String, Boolean>>() {}
        )

        currentOverrides[key] = enabled
        entity.overrides = objectMapper.writeValueAsString(currentOverrides)

        featureToggleOverridesRepository.save(entity)

        return FeatureToggleOverridesDto(currentOverrides)
    }

    @Transactional
    open fun removeToggle(key: String): FeatureToggleOverridesDto {
        val entity = featureToggleOverridesRepository.findByIdOrNull("singleton")
            ?: return FeatureToggleOverridesDto(emptyMap())

        val currentOverrides: MutableMap<String, Boolean> = objectMapper.readValue(
            entity.overrides, object : TypeReference<MutableMap<String, Boolean>>() {}
        )

        currentOverrides.remove(key)
        entity.overrides = objectMapper.writeValueAsString(currentOverrides)

        featureToggleOverridesRepository.save(entity)

        return FeatureToggleOverridesDto(currentOverrides)
    }
}
