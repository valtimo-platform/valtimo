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

package com.ritense.case_.widget.map

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.convertValue
import com.ritense.case_.widget.CaseWidgetDataProvider
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.map.geojson.GeoJson
import com.ritense.widget.map.geojson.GeoJsonMapper
import com.ritense.widget.map.geojson.Wgs84FeatureNormalizer
import java.util.UUID
import org.springframework.data.domain.Pageable

class MapCaseWidgetDataProvider(
    private val valueResolverService: ValueResolverService,
    private val objectMapper: ObjectMapper,
    private val geoJsonMappers: List<GeoJsonMapper>,
    private val wgs84FeatureNormalizer: Wgs84FeatureNormalizer,
) : CaseWidgetDataProvider {

    override fun supports(widget: Any): Boolean = widget is MapCaseWidget

    override fun getData(
        documentId: UUID,
        widget: Any,
        pageable: Pageable,
        caseDefinitionId: CaseDefinitionId
    ): Any {
        widget as MapCaseWidget
        val resolvedValues = valueResolverService.resolveValues(
            mapOf(DOCUMENT_ID to documentId.toString(), PAGEABLE to pageable),
            widget.getUnresolvedValues()
        )
        val geoJsonFeatures = widget.properties.geoJsonSources.flatMap { geoJsonSrc ->
            val geoJsonNode = objectMapper.convertValue<JsonNode>(resolvedValues[geoJsonSrc.key])
            val mapper = geoJsonMappers.firstOrNull { mapper -> mapper.supports(geoJsonNode) }
                ?: error("unsupported widget map data: $geoJsonNode")
            mapper.mapToFeatures(geoJsonNode).map(wgs84FeatureNormalizer::normalize)
        }

        return widget.getExposedValues { path -> resolvedValues[path] } + mapOf(
            "geoJsonFeatureCollection" to GeoJson.FeatureCollection(geoJsonFeatures)
        )
    }
}
