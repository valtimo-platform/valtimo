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

package com.ritense.adminsettings.importer

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.adminsettings.service.FeatureToggleOverridesService
import com.ritense.importer.ImportRequest
import com.ritense.importer.Importer
import com.ritense.importer.ValtimoImportTypes.Companion.ADMIN_SETTINGS_FEATURE_TOGGLES
import org.springframework.transaction.annotation.Transactional

@Transactional
class AdminSettingsFeatureToggleImporter(
    private val objectMapper: ObjectMapper,
    private val featureToggleOverridesService: FeatureToggleOverridesService,
) : Importer {

    override fun type(): String = ADMIN_SETTINGS_FEATURE_TOGGLES

    override fun dependsOn(): Set<String> = emptySet()

    override fun supports(fileName: String): Boolean = fileName.matches(FILENAME_REGEX)

    override fun partOfCaseDefinition(): Boolean = false

    override fun partOfBuildingBlockDefinition(): Boolean = false

    override fun import(request: ImportRequest) {
        val featureToggles: Map<String, Boolean> = objectMapper.readValue(
            request.content.toString(Charsets.UTF_8),
            object : TypeReference<Map<String, Boolean>>() {}
        )
        featureToggles.forEach { (key, enabled) ->
            featureToggleOverridesService.updateToggle(key, enabled)
        }
    }

    companion object {
        val FILENAME_REGEX = """/global/admin-settings/(?:.*/)?(.+)\.feature-toggles\.json""".toRegex()
    }
}
