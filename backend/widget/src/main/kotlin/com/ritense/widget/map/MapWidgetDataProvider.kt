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

package com.ritense.widget.map

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.convertValue
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.WidgetDataProvider
import com.ritense.widget.map.geojson.GeoJson
import com.ritense.widget.map.geojson.GeoJsonMapper

class MapWidgetDataProvider(
    private val valueResolverService: ValueResolverService,
    private val objectMapper: ObjectMapper,
    private val geoJsonMappers: List<GeoJsonMapper>,
) : WidgetDataProvider<MapWidget> {

    override fun supportedWidgetType() = MapWidget::class.java

    override fun getData(widget: MapWidget, properties: Map<String, Any>): Any {
        val resolvedValues = valueResolverService.resolveValues(properties, widget.getUnresolvedValues())

        val geoJsonFeatures = widget.properties.geoJsonSources.flatMap { geoJsonSrc ->
            val geoJsonNode = objectMapper.convertValue<JsonNode>(resolvedValues[geoJsonSrc.key])
            val mapper = geoJsonMappers.firstOrNull { mapper -> mapper.supports(geoJsonNode) }
                ?: error("unsupported widget map data: $geoJsonNode")
            mapper.mapToFeatures(geoJsonNode)
        }

        return widget.getExposedValues { path -> resolvedValues[path] } + mapOf(
            "geoJsonFeatureCollection" to GeoJson.FeatureCollection(geoJsonFeatures)
        )
    }
}
