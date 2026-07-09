/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

package com.ritense.case_.widget.image

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.widget.CaseWidgetDataProvider
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverService
import java.util.UUID
import org.springframework.data.domain.Pageable

class ImageCaseWidgetDataProvider(
    private val valueResolverService: ValueResolverService,
    private val objectMapper: ObjectMapper,
) : CaseWidgetDataProvider {

    override fun supports(widget: Any): Boolean = widget is ImageCaseWidget

    override fun getData(
        documentId: UUID,
        widget: Any,
        pageable: Pageable,
        caseDefinitionId: CaseDefinitionId
    ): Any {
        widget as ImageCaseWidget
        val resolvedValues = valueResolverService.resolveValues(
            mapOf(DOCUMENT_ID to documentId.toString(), PAGEABLE to pageable),
            widget.getUnresolvedValues()
        )
        val rawValue = resolvedValues[widget.properties.value]

        return widget.getExposedValues { path -> resolvedValues[path] } +
            mapOf("images" to toImages(rawValue))
    }

    private fun toImages(rawValue: Any?): List<ImageCaseWidgetDataResult> {
        if (rawValue == null) return emptyList()

        val node = objectMapper.valueToTree<JsonNode>(rawValue)
        val fileNodes = when {
            node.isArray -> node.toList()
            node.isObject -> listOf(node)
            else -> emptyList()
        }

        return fileNodes.mapNotNull { toImage(it) }
    }

    private fun toImage(node: JsonNode): ImageCaseWidgetDataResult? {
        val resourceId = textOrNull(node, "/data/resourceId") ?: textOrNull(node, "/id") ?: return null
        return ImageCaseWidgetDataResult(
            resourceId = resourceId,
            fileName = textOrNull(node, "/originalName") ?: textOrNull(node, "/name"),
            mimeType = textOrNull(node, "/type"),
            sizeInBytes = node.at("/size").takeUnless { it.isMissingNode || it.isNull }?.asLong(),
        )
    }

    private fun textOrNull(rootNode: JsonNode, path: String): String? {
        val node = rootNode.at(path)
        return if (node.isMissingNode || node.isNull) null else node.asText()
    }
}
