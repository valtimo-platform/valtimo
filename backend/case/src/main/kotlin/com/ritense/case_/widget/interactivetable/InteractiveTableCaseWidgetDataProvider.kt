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

package com.ritense.case_.widget.interactivetable

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.jayway.jsonpath.Configuration
import com.jayway.jsonpath.JsonPath
import com.jayway.jsonpath.Option
import com.ritense.case_.widget.CaseWidgetDataProvider
import com.ritense.case_.widget.exception.InvalidCollectionException
import com.ritense.case_.widget.exception.InvalidCollectionNodeTypeException
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.pageable.PageableHelper.withSize
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.NO_PAGE_SIZE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverService
import java.util.UUID
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable

class InteractiveTableCaseWidgetDataProvider(
    private val objectMapper: ObjectMapper,
    private val valueResolverService: ValueResolverService
) : CaseWidgetDataProvider {

    override fun supports(widget: Any): Boolean =
        widget is InteractiveTableCaseWidget

    override fun getData(
        documentId: UUID,
        widget: Any,
        pageable: Pageable,
        caseDefinitionId: CaseDefinitionId
    ): InteractiveTableCaseWidgetDataResult =
        getData(documentId, widget, pageable, caseDefinitionId, emptyMap())

    override fun getData(
        documentId: UUID,
        widget: Any,
        pageable: Pageable,
        caseDefinitionId: CaseDefinitionId,
        properties: Map<String, Any>
    ): InteractiveTableCaseWidgetDataResult {
        widget as InteractiveTableCaseWidget
        val pageSize = if (properties[NO_PAGE_SIZE] as Boolean? == true) widget.properties.defaultPageSize else null
        val effectivePageable = pageable.withSize(pageSize)

        val resolvedValues = valueResolverService.resolveValues(
            properties + mapOf(DOCUMENT_ID to documentId.toString(), PAGEABLE to effectivePageable),
            widget.getUnresolvedValues()
        )

        val collectionNode = objectMapper.valueToTree<JsonNode>(resolvedValues[widget.properties.collection])
        val exposedValues = widget.getExposedValues { path -> resolvedValues[path] }

        if (collectionNode.isNull) {
            return InteractiveTableCaseWidgetDataResult(
                table = PageImpl(emptyList(), effectivePageable, 0),
                resolved = exposedValues
            )
        }

        if (collectionNode.isArray) {
            val result = collectionNode
                .chunked(effectivePageable.pageSize)
                .getOrElse(effectivePageable.pageNumber) { listOf() }
            return InteractiveTableCaseWidgetDataResult(
                table = PageImpl(
                    toPageContent(widget, resolvedValues, result),
                    effectivePageable,
                    collectionNode.size().toLong()
                ),
                resolved = exposedValues
            )
        }

        val content = collectionNode["content"]
        if (content is ArrayNode) {
            val total = collectionNode["totalElements"]?.longValue() ?: content.size().toLong()
            return InteractiveTableCaseWidgetDataResult(
                table = PageImpl(toPageContent(widget, resolvedValues, content), effectivePageable, total),
                resolved = exposedValues
            )
        }

        throw InvalidCollectionException()
    }

    private fun toPageContent(
        widget: InteractiveTableCaseWidget,
        resolvedValues: Map<String, Any?>,
        content: Iterable<JsonNode>
    ): List<InteractiveTableCaseResult> {
        return content.onEachIndexed { index, node ->
            if (!node.isContainerNode) {
                throw InvalidCollectionNodeTypeException(index)
            }
        }.map { child ->
            InteractiveTableCaseResult(
                data = widget.properties.columns.associate { column ->
                    column.key to getValueAt(child, column.value)
                },
                resolved = widget.properties.rowClickAction?.getExposedValues { path ->
                    resolvedValues[path] ?: getValueAt(child, path)
                }
            )
        }
    }

    private fun getValueAt(data: JsonNode, path: String): Any? {
        return if (path.startsWith("$")) {
            JSONPATH_CONTEXT.parse(data.toString()).read<Any?>(path)
        } else {
            val pointer = if (path.startsWith("/")) path else "/$path"
            val valueNode = data.at(pointer)

            if (valueNode.isValueNode && !valueNode.isNull) {
                objectMapper.treeToValue<Any?>(valueNode)
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
