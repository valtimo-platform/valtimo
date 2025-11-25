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

package com.ritense.widget.map.geojson

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.node.ObjectNode
import com.fasterxml.jackson.module.kotlin.convertValue
import com.ritense.valtimo.contract.annotation.AllOpen

@AllOpen
class GeoJsonGeometryMapper(
    private val objectMapper: ObjectMapper,
) : GeoJsonMapper {

    override fun supports(node: JsonNode) = node.isObject && GEOMETRY_TYPES.contains(node["type"]?.textValue())

    override fun mapToFeatures(node: JsonNode): List<GeoJson.Feature> {
        val featureNode = objectMapper.createObjectNode().apply {
            put("type", "Feature")
            set<JsonNode>("geometry", node)
            set<ObjectNode>("properties", objectMapper.createObjectNode())
        }
        return listOf(objectMapper.convertValue(featureNode))
    }

    companion object {
        val GEOMETRY_TYPES = listOf(
            "Point",
            "LineString",
            "Polygon",
            "MultiPoint",
            "MultiLineString",
            "MultiPolygon"
        )
    }
}
