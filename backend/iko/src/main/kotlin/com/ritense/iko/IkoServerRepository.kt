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
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ContainerNode
import com.ritense.iko.client.IkoClient
import com.ritense.iko.dto.ContainerParam
import com.ritense.valtimo.contract.iko.DataFilter
import com.ritense.valtimo.contract.iko.IkoRepository
import com.ritense.valtimo.contract.iko.PropertyField
import com.ritense.valtimo.contract.iko.PropertyField.Companion.PROPERTY_FIELD_TYPE_KEY_VALUE_LIST
import com.ritense.valtimo.contract.iko.PropertyField.Companion.PROPERTY_FIELD_TYPE_URL
import java.net.URI
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable

class IkoServerRepository(
    private val ikoClient: IkoClient,
) : IkoRepository {

    override fun getType() = "iko"

    override fun getIkoRepositoryConfigPropertyFields(): List<PropertyField> {
        return listOf(
            PropertyField(IKO_SERVER_URL, PROPERTY_FIELD_TYPE_URL)
        )
    }

    override fun getIkoViewPropertyFields(): List<PropertyField> = listOf(
        PropertyField(
            key = CONNECTOR_TAG,
            title = "Connector Reference",
            tooltip = "The connector-reference or the connector-tag as defined in IKO"
        ),
        PropertyField(
            key = CONNECTOR_INSTANCE_TAG,
            title = "Connector Instance Reference",
            tooltip = "The connector-instance-reference or the connector-instance tag as defined in IKO"
        ),
        PropertyField(
            key = ENDPOINT_OPERATION,
            title = "Endpoint Reference",
            tooltip = "The endpoint-reference or the endpoint-operation as defined in IKO"
        ),
        PropertyField(
            key = ENDPOINT_QUERY_PARAMETERS,
            type = PROPERTY_FIELD_TYPE_KEY_VALUE_LIST,
            tooltip = "Additional query parameters for the IKO API URL. i.e. 'type=ZoekMetGeslachtsnaamEnGeboortedatum'",
            required = false,
        ),
    )

    override fun getIkoSearchActionPropertyFields(): List<PropertyField> = listOf(
        PropertyField(
            ENDPOINT_QUERY_PARAMETERS,
            PROPERTY_FIELD_TYPE_KEY_VALUE_LIST,
            tooltip = "Additional query parameters for the IKO API URL. i.e. 'type=ZoekMetGeslachtsnaamEnGeboortedatum'",
            required = false,
        ),
    )

    override fun getIkoTabPropertyFields(): List<PropertyField> = listOf(
        PropertyField(
            key = AGGREGATED_DATA_PROFILE_NAME,
            title = "Aggregated Data Profile Name (Optional)",
            tooltip = "The name of the aggregated data profile. i.e. 'personen'",
            required = false,
        ),
    )

    override fun findAll(
        config: Map<String, Any?>,
        filters: List<DataFilter>,
        pageable: Pageable
    ): Page<JsonNode> {
        val configuredFilterMap = (config[ENDPOINT_QUERY_PARAMETERS] as Map<String, String>?) ?: emptyMap()
        val filterMap = configuredFilterMap + filters.associate {
            val filterKey = it.property.substringAfter(':').substringBefore('=')
            val filterValue = it.property.substringAfter('=', "") + it.value.toString()
            filterKey to filterValue
        }

        val data = search(
            config = config,
            connectorTag = config[CONNECTOR_TAG].toString(),
            connectorInstanceTag = config[CONNECTOR_INSTANCE_TAG].toString(),
            endpointOperation = config[ENDPOINT_OPERATION].toString(),
            queryParams = filterMap,
        )

        val arrayData = breathFirstSearch(data) { it is ArrayNode } as ArrayNode?
        val dataList = arrayData?.toList() ?: listOf(data)
        return PageImpl(dataList, pageable, dataList.size.toLong())
    }

    fun findById(
        config: Map<String, Any?>,
        id: Any,
        containerParams: List<ContainerParam>
    ): JsonNode {
        val aggregatedDataProfileName = config[AGGREGATED_DATA_PROFILE_NAME] as String?
        val queryParams = (config[ENDPOINT_QUERY_PARAMETERS] as Map<String, String>?) ?: emptyMap()

        return if (!aggregatedDataProfileName.isNullOrBlank()) {
            getByAggregatedDataProfileId(
                config = config,
                aggregatedDataProfileName = aggregatedDataProfileName,
                id = id.toString(),
                containerParams = containerParams,
                additionalQueryParams = queryParams,
            )
        } else {
            getByEndpointId(
                config = config,
                connectorTag = config[CONNECTOR_TAG].toString(),
                connectorInstanceTag = config[CONNECTOR_INSTANCE_TAG].toString(),
                endpointOperation = config[ENDPOINT_OPERATION].toString(),
                id = id.toString(),
                queryParams = queryParams,
            )
        }
    }

    private fun getByEndpointId(
        config: Map<String, Any?>,
        connectorTag: String,
        connectorInstanceTag: String,
        endpointOperation: String,
        id: String,
        queryParams: Map<String, String>
    ): JsonNode {
        return ikoClient.getByEndpointId(
            URI(config[IKO_SERVER_URL].toString()),
            connectorTag,
            connectorInstanceTag,
            endpointOperation,
            id,
            queryParams,
        )
    }

    private fun search(
        config: Map<String, Any?>,
        connectorTag: String,
        connectorInstanceTag: String,
        endpointOperation: String,
        queryParams: Map<String, String> = emptyMap(),
    ): JsonNode {
        return ikoClient.search(
            URI(config[IKO_SERVER_URL].toString()),
            connectorTag,
            connectorInstanceTag,
            endpointOperation,
            queryParams,
        )
    }

    private fun getByAggregatedDataProfileId(
        config: Map<String, Any?>,
        aggregatedDataProfileName: String,
        id: String,
        containerParams: List<ContainerParam> = emptyList(),
        additionalQueryParams: Map<String, String> = emptyMap(),
    ): JsonNode {
        return ikoClient.getByAggregatedDataProfileId(
            URI(config[IKO_SERVER_URL].toString()),
            aggregatedDataProfileName,
            id,
            containerParams,
            additionalQueryParams,
        )
    }

    private fun breathFirstSearch(node: JsonNode, exitCondition: (JsonNode) -> Boolean): JsonNode? {
        val queue: ArrayDeque<JsonNode> = ArrayDeque()
        queue.add(node)

        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            if (exitCondition(current)) {
                return current
            }

            if (current is ContainerNode<*>) {
                current.forEach { child ->
                    queue.add(child)
                }
            }
        }

        return null
    }

    companion object {
        const val IKO_SERVER_URL = "ikoServerUrl"
        const val CONNECTOR_TAG = "connectorTag"
        const val CONNECTOR_INSTANCE_TAG = "connectorInstanceTag"
        const val ENDPOINT_OPERATION = "endpointOperation"
        const val AGGREGATED_DATA_PROFILE_NAME = "aggregatedDataProfileName"
        const val ENDPOINT_QUERY_PARAMETERS = "endpointQueryParameters"
    }
}
