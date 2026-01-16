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
import com.fasterxml.jackson.module.kotlin.treeToValue
import com.ritense.case_.service.CaseWidgetService
import com.ritense.case_.widget.table.TableCaseWidgetDto
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.iko.IkoServerRepository.Companion.AGGREGATED_DATA_PROFILE_NAME
import com.ritense.iko.IkoServerRepository.Companion.CONNECTOR_INSTANCE_TAG
import com.ritense.iko.IkoServerRepository.Companion.CONNECTOR_TAG
import com.ritense.iko.IkoServerRepository.Companion.ENDPOINT_OPERATION
import com.ritense.iko.IkoServerRepository.Companion.ENDPOINT_QUERY_PARAMETERS
import com.ritense.iko.IkoServerRepository.Companion.PLUGIN_CONFIGURATION
import com.ritense.iko.dto.ContainerParam
import com.ritense.iko.plugin.IkoPlugin
import com.ritense.iko.service.IkoTabService
import com.ritense.iko.service.IkoWidgetService
import com.ritense.plugin.service.PluginService
import com.ritense.valueresolver.ValueResolverFactory
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_ADP
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_VIEW_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PROCESS_INSTANCE_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.VARIABLE_SCOPE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import com.ritense.widget.collection.CollectionWidget
import com.ritense.widget.interactivetable.InteractiveTableWidget
import com.ritense.widget.table.TableWidget
import java.util.function.Function
import org.operaton.bpm.engine.delegate.VariableScope
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable

class IkoValueResolverFactory(
    private val ikoTabService: IkoTabService,
    private val objectMapper: ObjectMapper,
    private val pluginService: PluginService,
    private val ikoWidgetService: IkoWidgetService,
    private val caseWidgetService: CaseWidgetService,
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
            ?: getIkoAdpDataById(properties)
            ?: Function { null }
    }

    private fun getIkoViewDataById(properties: Map<String, Any>): Function<String, Any?>? {
        val ikoViewKey = properties[IKO_VIEW_KEY]?.toString() ?: return null
        val tabKey = properties[TAB_KEY]?.toString()
        val id = properties[ID]?.toString() ?: return null
        val config = ikoTabService.getIkoTabConfig(ikoViewKey, tabKey)
        val plugin = pluginService.createInstance<IkoPlugin>(config[PLUGIN_CONFIGURATION].toString())
        val adp = properties[IKO_ADP]?.toString() ?: config[AGGREGATED_DATA_PROFILE_NAME]?.toString()
        val data = if (adp != null) {
            plugin.getByAggregatedDataProfileId(
                aggregatedDataProfileName = adp,
                id = id,
                containerParams = getContainerParams(properties),
            )
        } else {
            val queryParams = config[ENDPOINT_QUERY_PARAMETERS] as Map<String, String>?
            plugin.getByEndpointId(
                connectorTag = config[CONNECTOR_TAG].toString(),
                connectorInstanceTag = config[CONNECTOR_INSTANCE_TAG].toString(),
                endpointOperation = config[ENDPOINT_OPERATION].toString(),
                id = id,
                queryParams = queryParams ?: emptyMap(),
            )
        }
        return toValueFunction(data)
    }

    private fun getIkoAdpDataById(properties: Map<String, Any>): Function<String, Any?>? {
        val adp = properties[IKO_ADP]?.toString() ?: return null
        val id = properties[ID]?.toString() ?: return null
        val plugin = checkNotNull(pluginService.createInstance(IkoPlugin::class.java) { true }) {
            "Could not find ${IkoPlugin::class.simpleName} configuration"
        }
        val data = plugin.getByAggregatedDataProfileId(
            aggregatedDataProfileName = adp,
            id = id,
            containerParams = getContainerParams(properties),
        )
        return toValueFunction(data)
    }

    private fun getContainerParams(properties: Map<String, Any>): List<ContainerParam> {
        return listOfNotNull(getIkoTableContainerParam(properties) ?: getCaseTableContainerParam(properties))
    }

    private fun getIkoTableContainerParam(properties: Map<String, Any>): ContainerParam? {
        val ikoViewKey = properties[IKO_VIEW_KEY]?.toString() ?: return null
        val tabKey = properties[TAB_KEY]?.toString() ?: return null
        val widgetKey = properties[WIDGET_KEY]?.toString() ?: return null
        val pageable = properties[PAGEABLE] as Pageable?
        return when (val widget = ikoWidgetService.getByKey(ikoViewKey, tabKey, widgetKey)) {
            is InteractiveTableWidget -> ContainerParam(
                containerId = widget.key,
                pageable = pageable ?: PageRequest.of(0, widget.properties.defaultPageSize),
                filters = widget.properties.filters
                    .flatMap { ContainerParam.fromFilter(it, properties[it.key]) }
                    .toMap()
            )

            is TableWidget -> ContainerParam(
                containerId = widget.key,
                pageable = pageable ?: PageRequest.of(0, widget.properties.defaultPageSize),
                filters = emptyMap()
            )

            is CollectionWidget -> ContainerParam(
                containerId = widget.key,
                pageable = pageable ?: PageRequest.of(0, widget.properties.defaultPageSize),
                filters = emptyMap()
            )

            else -> null
        }
    }

    private fun getCaseTableContainerParam(properties: Map<String, Any>): ContainerParam? {
        val documentId = properties[DOCUMENT_ID]?.toString()?.let { JsonSchemaDocumentId.existingId(it) } ?: return null
        val tabKey = properties[TAB_KEY]?.toString() ?: return null
        val widgetKey = properties[WIDGET_KEY]?.toString() ?: return null
        val pageable = properties[PAGEABLE] as Pageable?
        return when (val widget = caseWidgetService.getCaseWidget(documentId, tabKey, widgetKey)) {
            is TableCaseWidgetDto -> ContainerParam(
                containerId = widget.key,
                pageable = pageable ?: PageRequest.of(0, widget.properties.defaultPageSize),
                filters = emptyMap()
            )

            else -> null
        }
    }

    private fun toValueFunction(data: JsonNode): Function<String, Any?> {
        return Function { jsonPointer ->
            objectMapper.treeToValue<Any?>(data.at(jsonPointer))
        }
    }
}
