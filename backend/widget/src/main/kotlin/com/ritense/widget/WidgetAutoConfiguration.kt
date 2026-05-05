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

package com.ritense.widget

import ResolvedPageSerializer
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.collection.CollectionWidget
import com.ritense.widget.collection.CollectionWidgetDataProvider
import com.ritense.widget.custom.CustomWidget
import com.ritense.widget.custom.CustomWidgetDataProvider
import com.ritense.widget.divider.DividerWidget
import com.ritense.widget.highlight.HighlightWidget
import com.ritense.widget.highlight.HighlightWidgetDataProvider
import com.ritense.widget.domain.Widget
import com.ritense.widget.fields.FieldsWidget
import com.ritense.widget.fields.FieldsWidgetDataProvider
import com.ritense.widget.interactivetable.InteractiveTableWidget
import com.ritense.widget.map.MapWidget
import com.ritense.widget.map.MapWidgetDataProvider
import com.ritense.widget.map.geojson.GeoJsonFeatureCollectionMapper
import com.ritense.widget.map.geojson.GeoJsonFeatureMapper
import com.ritense.widget.map.geojson.GeoJsonGeometryCollectionMapper
import com.ritense.widget.map.geojson.GeoJsonGeometryMapper
import com.ritense.widget.map.geojson.GeoJsonLineStringMapper
import com.ritense.widget.map.geojson.GeoJsonMapper
import com.ritense.widget.map.geojson.GeoJsonMultiPolygonMapper
import com.ritense.widget.map.geojson.GeoJsonNullMapper
import com.ritense.widget.map.geojson.GeoJsonPointMapper
import com.ritense.widget.map.geojson.GeoJsonPolygonMapper
import com.ritense.widget.repository.WidgetRepository
import com.ritense.widget.service.WidgetService
import com.ritense.widget.table.TableWidget
import com.ritense.widget.table.TableWidgetDataProvider
import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.core.annotation.Order
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import javax.sql.DataSource

@AutoConfiguration
@EnableJpaRepositories(
    basePackageClasses = [
        WidgetRepository::class,
    ]
)
@EntityScan(
    basePackageClasses = [
        CollectionWidget::class,
        CustomWidget::class,
        DividerWidget::class,
        FieldsWidget::class,
        HighlightWidget::class,
        InteractiveTableWidget::class,
        MapWidget::class,
        TableWidget::class,
        Widget::class,
    ]
)
class WidgetAutoConfiguration {

    @Bean
    @ConditionalOnClass(DataSource::class)
    fun widgetService(
        widgetRepository: WidgetRepository,
        widgetDataProviders: List<WidgetDataProvider<*>>,
        valueResolverService: ValueResolverService,
    ): WidgetService {
        return WidgetService(
            widgetRepository,
            widgetDataProviders as List<WidgetDataProvider<Widget>>,
            valueResolverService,
        )
    }

    @ConditionalOnMissingBean(WidgetAnnotatedClassResolver::class)
    @Bean
    fun widgetAnnotatedClassResolver(
        context: ApplicationContext
    ) = WidgetAnnotatedClassResolver(context)

    @ConditionalOnMissingBean(WidgetJacksonModule::class)
    @Bean
    fun widgetJacksonModule(
        annotatedClassResolver: WidgetAnnotatedClassResolver
    ) = WidgetJacksonModule(annotatedClassResolver)

    @ConditionalOnMissingBean(FieldsWidgetDataProvider::class)
    @Bean
    fun fieldsWidgetDataProvider(
        valueResolverService: ValueResolverService,
    ) = FieldsWidgetDataProvider(valueResolverService)

    @ConditionalOnMissingBean(TableWidgetDataProvider::class)
    @Bean
    fun tableWidgetDataProvider(
        objectMapper: ObjectMapper,
        valueResolverService: ValueResolverService,
    ) = TableWidgetDataProvider(objectMapper, valueResolverService)

    @ConditionalOnMissingBean(CollectionWidgetDataProvider::class)
    @Bean
    fun collectionWidgetDataProvider(
        objectMapper: ObjectMapper,
        valueResolverService: ValueResolverService,
    ) = CollectionWidgetDataProvider(objectMapper, valueResolverService)

    @ConditionalOnMissingBean(CustomWidgetDataProvider::class)
    @Bean
    fun customWidgetDataProvider(
        valueResolverService: ValueResolverService,
    ) = CustomWidgetDataProvider(valueResolverService)

    @ConditionalOnMissingBean(HighlightWidgetDataProvider::class)
    @Bean
    fun highlightWidgetDataProvider(
        valueResolverService: ValueResolverService,
    ) = HighlightWidgetDataProvider(valueResolverService)

    @ConditionalOnMissingBean(ResolvedPageSerializer::class)
    @Bean
    fun resolvedPageSerializer(
    ) = ResolvedPageSerializer()

    @ConditionalOnMissingBean(GeoJsonGeometryMapper::class)
    @Bean
    fun geoJsonGeometryMapper(
        objectMapper: ObjectMapper,
    ) = GeoJsonGeometryMapper(
        objectMapper,
    )

    @ConditionalOnMissingBean(GeoJsonNullMapper::class)
    @Bean
    fun geoJsonNullMapper() = GeoJsonNullMapper()

    @ConditionalOnMissingBean(GeoJsonPointMapper::class)
    @Bean
    fun geoJsonPointMapper(
        objectMapper: ObjectMapper,
        geometryMapper: GeoJsonGeometryMapper,
    ) = GeoJsonPointMapper(
        objectMapper,
        geometryMapper,
    )

    @ConditionalOnMissingBean(GeoJsonPolygonMapper::class)
    @Bean
    fun geoJsonPolygonMapper(
        objectMapper: ObjectMapper,
        geometryMapper: GeoJsonGeometryMapper,
    ) = GeoJsonPolygonMapper(
        objectMapper,
        geometryMapper,
    )

    @ConditionalOnMissingBean(GeoJsonGeometryCollectionMapper::class)
    @Bean
    fun geoJsonGeometryCollectionMapper(
        geometryMapper: GeoJsonGeometryMapper,
    ) = GeoJsonGeometryCollectionMapper(
        geometryMapper,
    )

    @ConditionalOnMissingBean(GeoJsonFeatureMapper::class)
    @Bean
    fun geoJsonFeatureMapper(
        objectMapper: ObjectMapper,
    ) = GeoJsonFeatureMapper(
        objectMapper,
    )

    @ConditionalOnMissingBean(GeoJsonMultiPolygonMapper::class)
    @Bean
    fun geoJsonMultiPolygonMapper(
        objectMapper: ObjectMapper,
        geometryMapper: GeoJsonGeometryMapper,
    ) = GeoJsonMultiPolygonMapper(
        objectMapper,
        geometryMapper,
    )

    @ConditionalOnMissingBean(GeoJsonFeatureCollectionMapper::class)
    @Bean
    fun geoJsonFeatureCollectionMapper(
        objectMapper: ObjectMapper,
    ) = GeoJsonFeatureCollectionMapper(
        objectMapper,
    )

    @ConditionalOnMissingBean(GeoJsonLineStringMapper::class)
    @Bean
    fun geoJsonLineStringMapper(
        objectMapper: ObjectMapper,
        geometryMapper: GeoJsonGeometryMapper,
    ) = GeoJsonLineStringMapper(
        objectMapper,
        geometryMapper,
    )

    @ConditionalOnMissingBean(MapWidgetDataProvider::class)
    @Bean
    fun mapWidgetDataProvider(
        valueResolverService: ValueResolverService,
        objectMapper: ObjectMapper,
        geoJsonMappers: List<GeoJsonMapper>,
    ) = MapWidgetDataProvider(
        valueResolverService,
        objectMapper,
        geoJsonMappers,
    )

}
