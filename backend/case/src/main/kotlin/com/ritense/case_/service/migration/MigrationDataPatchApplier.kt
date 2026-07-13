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

package com.ritense.case_.service.migration

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.valueresolver.ValueResolverService
import java.util.UUID

/**
 * Applies a list of [DataMigrationPatch]es across **two** documents: `source` paths are read
 * against [sourceDocumentId] and `target` paths are written into [targetDocumentId]. The document
 * context is chosen purely by which id is passed to [ValueResolverService.resolveValues] /
 * [ValueResolverService.handleValues], so the same `doc:` paths work in either direction.
 *
 * The `case` module's `dataMigration` operates on a single document (source == target == the case),
 * while the `building-block` add/remove components use the two-document form (case ↔ building block).
 */
class MigrationDataPatchApplier(
    private val objectMapper: ObjectMapper,
    private val valueResolverService: ValueResolverService,
) {

    fun apply(patches: List<DataMigrationPatch>, sourceDocumentId: UUID, targetDocumentId: UUID) {
        if (patches.isEmpty()) return

        val sourcePaths = patches.mapNotNull { it.source }.distinct()
        val resolvedSources = if (sourcePaths.isEmpty()) {
            emptyMap()
        } else {
            valueResolverService.resolveValues(sourceDocumentId.toString(), sourcePaths)
        }

        val targetValues = LinkedHashMap<String, Any?>()
        patches.forEach { patch ->
            if (patch.source != null) {
                if (resolvedSources.containsKey(patch.source)) {
                    targetValues[patch.target] = coerce(resolvedSources[patch.source], patch.targetType)
                }
            } else {
                targetValues[patch.target] = coerce(patch.value, patch.targetType)
            }
        }

        if (targetValues.isNotEmpty()) {
            valueResolverService.handleValues(targetDocumentId, targetValues)
        }
    }

    private fun coerce(value: Any?, targetType: String?): Any? {
        if (value == null) return null
        return when (targetType?.lowercase()) {
            null -> value
            "string" -> objectMapper.convertValue(value, String::class.java)
            "integer", "long" -> objectMapper.convertValue(value, Long::class.javaObjectType)
            "number", "double" -> objectMapper.convertValue(value, Double::class.javaObjectType)
            "boolean" -> objectMapper.convertValue(value, Boolean::class.javaObjectType)
            else -> value
        }
    }
}
