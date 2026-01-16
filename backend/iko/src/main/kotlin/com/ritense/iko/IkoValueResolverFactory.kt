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

package com.ritense.iko

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.ritense.iko.service.IkoSearchActionService
import com.ritense.iko.service.IkoSearchFieldService
import com.ritense.iko.service.IkoTabService
import com.ritense.iko.service.IkoViewService
import com.ritense.valtimo.contract.iko.DataFilter
import com.ritense.valueresolver.ValueResolverFactory
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_SEARCH_ACTION_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_VIEW_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PROCESS_INSTANCE_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.VARIABLE_SCOPE
import java.util.function.Function
import org.operaton.bpm.engine.delegate.VariableScope
import org.springframework.data.domain.Pageable

class IkoValueResolverFactory(
    private val ikoTabService: IkoTabService,
    private val ikoSearchActionService: IkoSearchActionService,
    private val ikoSearchFieldService: IkoSearchFieldService,
    private val objectMapper: ObjectMapper,
) : ValueResolverFactory {

    override fun supportedPrefix(): String {
        return "iko"
    }

    override fun createResolver(documentId: String): Function<String, Any?> {
        return createResolver(mapOf(DOCUMENT_ID to documentId))
    }

    override fun createResolver(processInstanceId: String, variableScope: VariableScope): Function<String, Any?> {
        return createResolver(mapOf(PROCESS_INSTANCE_ID to processInstanceId, VARIABLE_SCOPE to variableScope))
    }

    override fun createResolver(properties: Map<String, Any>): Function<String, Any?> {
        return getIkoViewDataById(properties)
            ?: searchIkoViewData(properties)
            ?: Function { null }
    }

    private fun getIkoViewDataById(properties: Map<String, Any>): Function<String, Any?>? {
        val ikoViewKey = properties[IKO_VIEW_KEY]?.toString()
        val tabKey = properties[TAB_KEY]?.toString()
        val id = properties[ID]?.toString()
        if (ikoViewKey != null && id != null) {
            val data = ikoTabService.getDataById(ikoViewKey, tabKey, id)
            return toValueFunction(data)
        }
        return null
    }

    private fun searchIkoViewData(properties: Map<String, Any>): Function<String, Any?>? {
        val ikoViewKey = properties[IKO_VIEW_KEY]?.toString()
        val ikoSearchActionKey = properties[IKO_SEARCH_ACTION_KEY]?.toString()
        if (ikoViewKey == null || ikoSearchActionKey == null) {
            return null
        }
        val (ikoSearchAction, searchFields) = ikoSearchActionService.findAll(
            key = ikoSearchActionKey,
            ikoViewKey = ikoViewKey,
        ).map { ikoSearchAction ->
            ikoSearchAction to ikoSearchFieldService.findAllSearchFieldsByIkoSearchAction(
                ikoViewKey = ikoSearchAction.id.ikoView.key,
                ikoSearchActionKey = ikoSearchAction.id.key
            )
        }
            .filter { (_, searchFields) -> searchFields.all { properties.contains(it.key) || !it.required } }
            .map { (ikoSearchAction, searchFields) -> ikoSearchAction to searchFields.filter { properties.contains(it.key) } }
            .firstOrNull() ?: return null

        val filters = searchFields.map { searchField -> DataFilter(searchField.path, properties[searchField.key]) }
        val pageable = properties[PAGEABLE] as Pageable? ?: Pageable.unpaged()
        val dataPaged = ikoSearchActionService.searchData(
            key = ikoSearchAction.id.key,
            ikoViewKey = ikoSearchAction.id.ikoView.key,
            filters = filters,
            pageable = pageable
        )
        val data = objectMapper.valueToTree<ArrayNode>(dataPaged.content)
        return toValueFunction(data)
    }

    private fun toValueFunction(data: JsonNode): Function<String, Any?> {
        return Function { jsonPointer ->
            objectMapper.treeToValue<Any?>(data.at(jsonPointer))
        }
    }
}
