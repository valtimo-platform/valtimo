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

import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import com.fasterxml.jackson.annotation.JsonTypeName

@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.PROPERTY,
    property = "type"
)
@JsonSubTypes(
    JsonSubTypes.Type(value = GeoJson.FeatureCollection::class, name = "FeatureCollection"),
    JsonSubTypes.Type(value = GeoJson.Feature::class, name = "Feature"),
    JsonSubTypes.Type(value = GeoJson.Point::class, name = "Point"),
    JsonSubTypes.Type(value = GeoJson.LineString::class, name = "LineString"),
    JsonSubTypes.Type(value = GeoJson.Polygon::class, name = "Polygon"),
    JsonSubTypes.Type(value = GeoJson.MultiPoint::class, name = "MultiPoint"),
    JsonSubTypes.Type(value = GeoJson.MultiLineString::class, name = "MultiLineString"),
    JsonSubTypes.Type(value = GeoJson.MultiPolygon::class, name = "MultiPolygon"),
    JsonSubTypes.Type(value = GeoJson.GeometryCollection::class, name = "GeometryCollection"),
)
sealed interface GeoJson {

    @JsonTypeName("FeatureCollection")
    data class FeatureCollection(val features: List<Feature>) : GeoJson

    data class Feature(
        val geometry: Geometry? = null,
        val properties: Map<String, Any> = emptyMap(),
    ) : GeoJson

    sealed interface Geometry : GeoJson

    data class Point(val coordinates: List<Double>) : Geometry
    data class LineString(val coordinates: List<List<Double>>) : Geometry
    data class Polygon(val coordinates: List<List<List<Double>>>) : Geometry
    data class MultiPoint(val coordinates: List<List<Double>>) : Geometry
    data class MultiLineString(val coordinates: List<List<List<Double>>>) : Geometry
    data class MultiPolygon(val coordinates: List<List<List<List<Double>>>>) : Geometry
    data class GeometryCollection(val geometries: List<Geometry>) : Geometry
}
