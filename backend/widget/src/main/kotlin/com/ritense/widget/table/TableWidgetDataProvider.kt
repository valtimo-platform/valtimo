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

package com.ritense.widget.table

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.jayway.jsonpath.Configuration
import com.jayway.jsonpath.JsonPath
import com.jayway.jsonpath.Option
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.pageable.PageableHelper.withSize
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.NO_PAGE_SIZE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.WidgetDataProvider
import com.ritense.widget.exception.InvalidCollectionException
import com.ritense.widget.exception.InvalidCollectionNodeTypeException
import com.ritense.widget.page.ResolvedPage
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Component

@Component
@SkipComponentScan
class TableWidgetDataProvider(
    private val objectMapper: ObjectMapper,
    private val valueResolverService: ValueResolverService,
) : WidgetDataProvider<TableWidget> {

    override fun supportedWidgetType() = TableWidget::class.java

    override fun getData(widget: TableWidget, properties: Map<String, Any>): ResolvedPage<Map<String, Any?>> {
        val pageSize = if (properties[NO_PAGE_SIZE] as Boolean) widget.properties.defaultPageSize else null
        val pageable = (properties[PAGEABLE] as Pageable?).withSize(pageSize)

        val resolvedValues = valueResolverService.resolveValues(
            properties + mapOf(PAGEABLE to pageable),
            widget.getUnresolvedValues()
        )

        val collectionNode = objectMapper.valueToTree<JsonNode>(resolvedValues[widget.properties.collection])
        val exposedValues = widget.getExposedValues { path -> resolvedValues[path] }

        if (collectionNode.isNull) {
            return ResolvedPage(
                content = emptyList(),
                resolved = exposedValues,
                pageable = pageable,
                total = 0
            )
        }

        if (collectionNode.isArray) {
            val result = collectionNode
                .chunked(pageable.pageSize)
                .getOrElse(pageable.pageNumber, defaultValue = { _ -> listOf() })
            val content = toPageContent(widget, result)
            return ResolvedPage(
                content = content,
                resolved = exposedValues,
                pageable = pageable,
                total = collectionNode.size().toLong()
            )
        } else if (collectionNode["content"] is ArrayNode) {
            val result = collectionNode["content"] as ArrayNode
            val content = toPageContent(widget, result)
            val total = collectionNode["totalElements"]?.longValue() ?: result.size().toLong()
            return ResolvedPage(
                content = content,
                resolved = exposedValues,
                pageable = pageable,
                total = total
            )
        } else {
            throw InvalidCollectionException()
        }
    }

    private fun toPageContent(
        widget: TableWidget,
        content: Iterable<JsonNode>,
    ): List<Map<String, Any?>> {
        return content.onEachIndexed { index, node ->
            if (!node.isContainerNode) {
                throw InvalidCollectionNodeTypeException(index)
            }
        }.map { child ->
            widget.properties.columns.associate { column ->
                column.key to getValueAt(child, column.value)
            }
        }
    }

    private fun getValueAt(data: JsonNode, path: String): Any? {
        return if (path.startsWith("$")) {
            JSONPATH_CONTEXT.parse(data.toString()).read<Any?>(path)
        } else {
            val pointer = if (path.startsWith("/")) path else "/${path}"
            val valueNode = data.at(pointer)

            if (valueNode.isValueNode && !valueNode.isNull) {
                objectMapper.treeToValue(valueNode)
            } else {
                null
            }
        }
    }

    private companion object {
        val JSONPATH_CONTEXT =
            JsonPath.using(Configuration.defaultConfiguration().addOptions(Option.SUPPRESS_EXCEPTIONS))
    }
}

