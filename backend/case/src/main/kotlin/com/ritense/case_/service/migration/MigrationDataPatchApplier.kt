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
import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.case_.domain.migration.DataMigrationPatch
import com.ritense.valueresolver.ValueResolverService
import java.util.UUID

/** Applies patches across two documents: `source` paths read against [sourceDocumentId], `target` paths written into [targetDocumentId]. The `case` module passes the same id for both. */
class MigrationDataPatchApplier(
    private val objectMapper: ObjectMapper,
    private val valueResolverService: ValueResolverService,
) {

    fun apply(patches: List<DataMigrationPatch>, sourceDocumentId: UUID, targetDocumentId: UUID) {
        if (patches.isEmpty()) return

        val targetValues = resolveValues(patches, sourceDocumentId)
        if (targetValues.isNotEmpty()) {
            valueResolverService.handleValues(targetDocumentId, targetValues)
        }
    }

    /** Resolves [patches] into initial document content, so a document can be created already populated and pass schema validation. Only `doc:`-targeted patches contribute. */
    fun resolveToContent(
        patches: List<DataMigrationPatch>,
        sourceDocumentId: UUID,
        targetDocumentDefinitionName: String,
    ): ObjectNode {
        val docPatches = patches.filter { it.target.startsWith(DOC_TARGET_PREFIX) }
        if (docPatches.isEmpty()) return objectMapper.createObjectNode()

        val docValues = resolveValues(docPatches, sourceDocumentId)

        // Reuses the new-document assembly path, so the resolver's own pointer handling and null-write rules apply. One `doc:` prefix means exactly one resolver group comes back.
        return valueResolverService.preProcessValuesForNewDocument(docValues, targetDocumentDefinitionName)
            .values.singleOrNull() as? ObjectNode
            ?: objectMapper.createObjectNode()
    }

    /** Resolves [patches] into an ordered `target -> value` map. A copy patch skips an absent source — passing the null on would clear the target — while a literal patch writes its value, null included. */
    private fun resolveValues(
        patches: List<DataMigrationPatch>,
        sourceDocumentId: UUID,
    ): LinkedHashMap<String, Any?> {
        val sourcePaths = patches.mapNotNull { it.source }.distinct()
        val resolvedSources = if (sourcePaths.isEmpty()) {
            emptyMap()
        } else {
            valueResolverService.resolveValues(sourceDocumentId.toString(), sourcePaths)
        }

        val values = LinkedHashMap<String, Any?>()
        patches.forEach { patch ->
            if (patch.source != null) {
                val resolved = coerce(resolvedSources[patch.source], patch.targetType)
                if (resolved != null) {
                    values[patch.target] = resolved
                }
            } else {
                values[patch.target] = coerce(patch.value, patch.targetType)
            }
        }
        return values
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

    private companion object {
        const val DOC_TARGET_PREFIX = "doc:"
    }
}
