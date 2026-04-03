/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.document.mongodb.service

import com.fasterxml.jackson.databind.JsonNode

/**
 * Extracts all leaf values from a [JsonNode] as a single space-separated string.
 * Used to populate [com.ritense.document.mongodb.domain.JsonSchemaDocumentDocument.contentText]
 * for full-document search.
 */
fun extractLeafValues(node: JsonNode?): String? {
    if (node == null) return null
    val parts = mutableListOf<String>()
    collectLeaves(node, parts)
    return parts.joinToString(" ").ifBlank { null }
}

private fun collectLeaves(node: JsonNode, out: MutableList<String>) {
    when {
        node.isObject -> node.fields().forEach { (_, v) -> collectLeaves(v, out) }
        node.isArray -> node.forEach { collectLeaves(it, out) }
        !node.isNull && !node.isMissingNode -> out.add(node.asText())
    }
}
