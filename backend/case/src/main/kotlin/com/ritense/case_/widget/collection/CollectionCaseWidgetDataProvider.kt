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
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.case_.widget.collection

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.jayway.jsonpath.Configuration
import com.jayway.jsonpath.JsonPath
import com.jayway.jsonpath.Option
import com.ritense.case_.widget.CaseWidgetDataProvider
import com.ritense.case_.widget.exception.InvalidCollectionException
import com.ritense.case_.widget.exception.InvalidCollectionNodeTypeException
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.page.ResolvedPage
import java.util.UUID
import org.springframework.data.domain.Pageable

class CollectionCaseWidgetDataProvider(
    private val objectMapper: ObjectMapper,
    private val valueResolverService: ValueResolverService
) : CaseWidgetDataProvider {

    override fun supports(widget: Any): Boolean =
        widget is CollectionCaseWidget

    override fun getData(
        documentId: UUID,
        widget: Any,
        pageable: Pageable,
        caseDefinitionId: CaseDefinitionId
    ): ResolvedPage<CollectionCaseWidgetDataResult> {
        widget as CollectionCaseWidget
        val resolvedValues = valueResolverService.resolveValues(
            mapOf(DOCUMENT_ID to documentId.toString(), PAGEABLE to pageable),
            widget.getUnresolvedValues()
        )
        val collectionNode = objectMapper.valueToTree<JsonNode>(resolvedValues[widget.properties.collection])
        val exposedValues = widget.getExposedValues { path -> resolvedValues[path] }

        if (collectionNode.isNull) {
            return ResolvedPage(emptyList(), pageable, 0, exposedValues)
        }

        if (!collectionNode.isArray) {
            throw InvalidCollectionException()
        }

        val pagedCollection = collectionNode.chunked(pageable.pageSize)

        val result = pagedCollection.getOrElse(pageable.pageNumber) { listOf() }
            .onEachIndexed { index, node ->
                if (!node.isContainerNode) {
                    throw InvalidCollectionNodeTypeException(index)
                }
            }.map { child ->
                CollectionCaseWidgetDataResult(
                    title = resolveValueRef(widget.properties.title.value, child),
                    fields = widget.properties.fields.associate { column ->
                        column.key to resolveValueRef(column.value, child)
                    }
                )
            }

        return ResolvedPage(result, pageable, collectionNode.size().toLong(), exposedValues)
    }

    private fun resolveValueRef(valueRef: String, child: JsonNode): Any? {
        return if (valueRef.startsWith("$")) {
            JSONPATH_CONTEXT.parse(child.toString()).read<Any>(valueRef)
        } else {
            val pointer = if (valueRef.startsWith("/")) valueRef else "/$valueRef"
            val valueNode = child.at(pointer)
            if (valueNode.isValueNode && !valueNode.isNull) {
                objectMapper.treeToValue<Any?>(valueNode)
            } else {
                null
            }
        }
    }

    private companion object {
        val JSONPATH_CONTEXT = JsonPath.using(
            Configuration.defaultConfiguration().addOptions(Option.SUPPRESS_EXCEPTIONS)
        )
    }
}
