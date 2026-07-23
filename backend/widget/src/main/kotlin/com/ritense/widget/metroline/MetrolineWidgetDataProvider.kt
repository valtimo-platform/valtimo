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

package com.ritense.widget.metroline

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.jayway.jsonpath.Configuration
import com.jayway.jsonpath.JsonPath
import com.jayway.jsonpath.Option
import com.ritense.valtimo.contract.json.Iso8601Deserializer
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.WidgetDataProvider
import java.time.LocalDateTime

class MetrolineWidgetDataProvider(
    private val objectMapper: ObjectMapper,
    private val valueResolverService: ValueResolverService,
) : WidgetDataProvider<MetrolineWidget> {

    override fun supportedWidgetType() = MetrolineWidget::class.java

    override fun getData(widget: MetrolineWidget, properties: Map<String, Any>): List<MetrolineItem> {
        val resolvedValues = valueResolverService.resolveValues(properties, widget.getUnresolvedValues())
        val collectionNode = objectMapper.valueToTree<JsonNode>(resolvedValues[widget.properties.source])

        if (collectionNode == null || collectionNode.isNull || collectionNode.isMissingNode) return emptyList()
        if (!collectionNode.isArray) return emptyList()

        return collectionNode.mapNotNull { row ->
            if (!row.isContainerNode) return@mapNotNull null
            val title = resolveStringAt(row, widget.properties.titlePath) ?: return@mapNotNull null
            val label = widget.properties.labelPath?.let { resolveStringAt(row, it) }
            val completed = resolveLocalDateTimeAt(row, widget.properties.completedPath)
            MetrolineItem(title = title, label = label, completed = completed)
        }
    }

    private fun resolveStringAt(row: JsonNode, path: String): String? {
        val node = resolveNodeAt(row, path) ?: return null
        if (!node.isValueNode || node.isNull) return null
        return node.asText()
    }

    private fun resolveLocalDateTimeAt(row: JsonNode, path: String): LocalDateTime? {
        val node = resolveNodeAt(row, path) ?: return null
        if (!node.isValueNode || node.isNull) return null
        val text = node.asText().takeIf { it.isNotBlank() } ?: return null
        return Iso8601Deserializer.parseOrNull(text)?.toLocalDateTime()
    }

    private fun resolveNodeAt(row: JsonNode, path: String): JsonNode? {
        if (path.startsWith("$")) {
            val raw = JSONPATH_CONTEXT.parse(row.toString()).read<Any?>(path) ?: return null
            return objectMapper.valueToTree(raw)
        }
        val pointer = if (path.startsWith("/")) path else "/$path"
        val node = row.at(pointer)
        if (node.isMissingNode) return null
        return node
    }

    private companion object {
        val JSONPATH_CONTEXT =
            JsonPath.using(Configuration.defaultConfiguration().addOptions(Option.SUPPRESS_EXCEPTIONS))
    }
}
