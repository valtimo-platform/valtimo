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
import com.ritense.iko.plugin.IkoPlugin
import com.ritense.iko.service.IkoSearchActionService
import com.ritense.iko.service.IkoSearchFieldService
import com.ritense.iko.service.IkoViewService
import com.ritense.plugin.service.PluginService
import com.ritense.valueresolver.ValueResolverFactory
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_VIEW_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PROCESS_INSTANCE_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.VARIABLE_SCOPE
import java.net.URI
import java.util.function.Function
import org.operaton.bpm.engine.delegate.VariableScope

class IkoValueResolverFactory(
    private val ikoViewService: IkoViewService,
    private val ikoSearchActionService: IkoSearchActionService,
    private val ikoSearchFieldService: IkoSearchFieldService,
    private val objectMapper: ObjectMapper,
    private val pluginService: PluginService,
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
        val id = properties[ID]?.toString()
        if (ikoViewKey != null && id != null) {
            val data = ikoViewService.getDataById(ikoViewKey, id)
            return toValueFunction(data)
        }
        return null
    }

    private fun getIkoPlugin(): IkoPlugin {
        return checkNotNull(pluginService.createInstance(IkoPlugin::class.java) { true }) {
            "Could not find ${IkoPlugin::class.simpleName} configuration"
        }
    }

    private fun toValueFunction(data: JsonNode): Function<String, Any?> {
        return Function { jsonPointer ->
            objectMapper.treeToValue<Any?>(data.at(jsonPointer))
        }
    }
}
