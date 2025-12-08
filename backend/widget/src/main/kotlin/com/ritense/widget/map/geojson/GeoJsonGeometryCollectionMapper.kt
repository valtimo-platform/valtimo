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
import com.ritense.valtimo.contract.annotation.AllOpen

@AllOpen
class GeoJsonGeometryCollectionMapper(
    geometryMapper: GeoJsonGeometryMapper,
) : GeoJsonMapper {

    private var geoJsonMappers: List<GeoJsonMapper> = listOf(geometryMapper, this)

    override fun supports(node: JsonNode) = node.isObject && node["type"]?.textValue() == "GeometryCollection"

    override fun mapToFeatures(node: JsonNode): List<GeoJson.Feature> {
        val geometriesNode =
            node["geometries"] ?: error("GeometryCollection missing property 'geometries' for node: $node")
        return geometriesNode.flatMap { childNode ->
            val mapper = geoJsonMappers.firstOrNull { mapper -> mapper.supports(childNode) }
                ?: error("unknown geometry for node: $childNode")
            mapper.mapToFeatures(childNode)
        }
    }

}
