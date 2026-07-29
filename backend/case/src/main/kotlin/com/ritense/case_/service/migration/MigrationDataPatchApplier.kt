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

        val targetValues = resolveValues(patches, sourceDocumentId)
        if (targetValues.isNotEmpty()) {
            valueResolverService.handleValues(targetDocumentId, targetValues)
        }
    }

    /**
     * Resolves [patches] into an initial document-content node, so a document can be **created
     * already populated** (schema validation at creation then succeeds even when the target schema
     * has required fields). Only `doc:`-targeted patches contribute to document content; any other
     * targets are ignored here and must be applied against the persisted document via [apply].
     * `source` paths are read against [sourceDocumentId]; `value` patches are written as-is.
     */
    fun resolveToContent(
        patches: List<DataMigrationPatch>,
        sourceDocumentId: UUID,
        targetDocumentDefinitionName: String,
    ): ObjectNode {
        val docPatches = patches.filter { it.target.startsWith(DOC_TARGET_PREFIX) }
        if (docPatches.isEmpty()) return objectMapper.createObjectNode()

        val docValues = resolveValues(docPatches, sourceDocumentId)

        // Delegate the doc-content assembly to the same path used when creating a new document, so
        // the resolver's own pointer/array handling is reused instead of a hand-rolled path walker.
        // Passing the target definition lets the resolver write 'null' values as the schema allows
        // (write null, drop the node, or reject a required field).
        // All keys share the `doc:` prefix, so exactly one resolver group comes back; take it without
        // naming the prefix, keeping the doc-resolver's internals inside the value-resolver framework.
        return valueResolverService.preProcessValuesForNewDocument(docValues, targetDocumentDefinitionName)
            .values.singleOrNull() as? ObjectNode
            ?: objectMapper.createObjectNode()
    }

    /**
     * Resolves [patches] against [sourceDocumentId] into an ordered `target -> value` map. Copy
     * patches (`source` set) skip an absent or null source: there is nothing to copy, and passing a
     * null on would let the resolver clear the target (its `null` handling removes an optional node),
     * which must not happen when the source merely wasn't present. Literal patches (`source` null)
     * write the fixed value, including an explicit null — which the resolver then writes, drops, or
     * rejects according to the target document's schema.
     */
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
