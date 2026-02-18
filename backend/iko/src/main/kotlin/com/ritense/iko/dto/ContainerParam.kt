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

package com.ritense.iko.dto

import com.ritense.search.domain.FieldType
import com.ritense.search.domain.SearchFieldMatchType
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.widget.interactivetable.InteractiveTableWidgetProperties.FilterConfig
import org.springframework.data.domain.Pageable

data class ContainerParam(
    val containerId: String,
    val pageable: Pageable,
    val filters: Map<String, String>
) {
    companion object {
        fun fromFilter(config: FilterConfig, value: Any?): List<Pair<String, String>> {
            return if (value == null || value == "") {
                emptyList()
            } else if (config.matchType == SearchFieldMatchType.LIKE) {
                listOf(config.key + "~" to value.toString())
            } else if (config.fieldType == FieldType.RANGE) {
                val parsedValue = if (value is String && value.contains("rangeFrom")) {
                    MapperSingleton.get().readValue(value, Map::class.java)
                } else {
                    value
                }
                if (parsedValue is Map<*, *>) {
                    val filter = mutableListOf<Pair<String, String>>()
                    parsedValue["rangeFrom"]?.let { filter.add(config.key + ">=" to it.toString()) }
                    parsedValue["rangeTo"]?.let { filter.add(config.key + "<" to it.toString()) }
                    filter
                } else {
                    error("Unsupported combination of filter config and value: $config, $value")
                }
            } else if (config.fieldType == FieldType.MULTI_SELECT_DROPDOWN) {
                val listValue = (value as? Collection<*>)?.filterNotNull() ?: listOf(value)
                if (listValue.isEmpty()) {
                    emptyList()
                } else {
                    listOf(config.key to listValue.joinToString(","))
                }
            } else if (config.matchType == SearchFieldMatchType.EXACT) {
                listOf(config.key to value.toString())
            } else {
                error("Unsupported combination of filter config and value: $config, $value")
            }
        }
    }
}