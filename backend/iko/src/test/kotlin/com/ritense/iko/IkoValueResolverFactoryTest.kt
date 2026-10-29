/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import com.fasterxml.jackson.databind.node.JsonNodeFactory
import com.ritense.case_.service.CaseWidgetService
import com.ritense.case_.widget.collection.CollectionCaseWidgetDto
import com.ritense.case_.widget.interactivetable.InteractiveTableCaseWidgetDto
import com.ritense.case_.widget.interactivetable.InteractiveTableCaseWidgetProperties
import com.ritense.case_.widget.table.TableCaseWidgetDto
import com.ritense.iko.IkoServerRepository.Companion.IKO_SERVER_URL
import com.ritense.iko.dto.ContainerParam
import com.ritense.iko.repository.IkoRepositoryConfigRepository
import com.ritense.iko.service.IkoTabService
import com.ritense.iko.service.IkoWidgetService
import com.ritense.search.domain.DataType
import com.ritense.search.domain.FieldType
import com.ritense.search.domain.SearchFieldMatchType
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_ADP
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.IKO_VIEW_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import com.ritense.case_.widget.collection.CollectionWidgetProperties
import com.ritense.widget.interactivetable.InteractiveTableWidget
import com.ritense.widget.interactivetable.InteractiveTableWidgetProperties
import com.ritense.case_.widget.table.TableWidgetProperties
import java.util.UUID
import kotlin.test.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.PageRequest

class IkoValueResolverFactoryTest {

    private val caseWidgetService: CaseWidgetService = mock()
    private val ikoServerRepository: IkoServerRepository = mock()
    private val ikoTabService: IkoTabService = mock()
    private val ikoWidgetService: IkoWidgetService = mock()
    private val factory = IkoValueResolverFactory(
        ikoTabService = ikoTabService,
        objectMapper = MapperSingleton.get(),
        ikoWidgetService = ikoWidgetService,
        caseWidgetService = caseWidgetService,
        ikoServerRepository = ikoServerRepository,
        ikoRepositoryConfigRepository = mock<IkoRepositoryConfigRepository>(),
    )

    private val documentId = UUID.randomUUID()

    @Test
    fun `should pass case interactive table pageable and filters as container param`() {
        mockWidget()
        whenever(ikoServerRepository.findById(any(), any(), any())).thenReturn(JsonNodeFactory.instance.objectNode())
        val pageable = PageRequest.of(2, 7)

        factory.createResolver(
            mapOf(
                DOCUMENT_ID to documentId.toString(),
                TAB_KEY to "tab",
                WIDGET_KEY to "widget",
                IKO_ADP to "adp",
                ID to "1",
                IKO_SERVER_URL to "http://iko",
                PAGEABLE to pageable,
                "name" to "john",
                "status" to "",
            )
        ).apply("/anything")

        val captor = argumentCaptor<List<ContainerParam>>()
        verify(ikoServerRepository).findById(any(), eq("1"), captor.capture())
        assertEquals(
            listOf(ContainerParam("widget", pageable, mapOf("name" to "john"))),
            captor.firstValue
        )
    }

    @Test
    fun `should fall back to default page size when no pageable given`() {
        mockWidget()
        whenever(ikoServerRepository.findById(any(), any(), any())).thenReturn(JsonNodeFactory.instance.objectNode())

        factory.createResolver(
            mapOf(
                DOCUMENT_ID to documentId.toString(),
                TAB_KEY to "tab",
                WIDGET_KEY to "widget",
                IKO_ADP to "adp",
                ID to "1",
                IKO_SERVER_URL to "http://iko",
            )
        ).apply("/anything")

        val captor = argumentCaptor<List<ContainerParam>>()
        verify(ikoServerRepository).findById(any(), eq("1"), captor.capture())
        assertEquals(PageRequest.of(0, 15), captor.firstValue.single().pageable)
    }

    @Test
    fun `should not treat case tab key as iko tab key for view resolution`() {
        mockWidget()
        whenever(ikoTabService.getIkoTabConfig(any(), anyOrNull())).thenReturn(emptyMap())
        whenever(ikoServerRepository.findById(any(), any(), any())).thenReturn(JsonNodeFactory.instance.objectNode())

        factory.createResolver(
            mapOf(
                DOCUMENT_ID to documentId.toString(),
                TAB_KEY to "tab",
                WIDGET_KEY to "widget",
                IKO_VIEW_KEY to "demo",
                ID to "1",
            )
        ).apply("/anything")

        verify(ikoTabService).getIkoTabConfig("demo", null)
    }

    @Test
    fun `should map case filters of each type into container param filters`() {
        mockWidget(
            filters = listOf(
                filter("name", FieldType.SINGLE, SearchFieldMatchType.LIKE),
                filter("n", FieldType.RANGE),
                filter("s", FieldType.MULTI_SELECT_DROPDOWN),
                filter("empty", FieldType.SINGLE),
                filter("missing", FieldType.SINGLE),
            )
        )
        whenever(ikoServerRepository.findById(any(), any(), any())).thenReturn(JsonNodeFactory.instance.objectNode())

        factory.createResolver(
            caseProperties() + mapOf(
                "name" to "jo",
                "n" to """{"rangeFrom":"1","rangeTo":"5"}""",
                "s" to listOf("a", "b"),
                "empty" to "",
            )
        ).apply("/anything")

        assertEquals(
            mapOf("name~" to "jo", "n>=" to "1", "n<" to "5", "s" to "a,b"),
            capturedContainerParams().single().filters
        )
    }

    @Test
    fun `should create container param with default page size and no filters for case collection widget`() {
        whenever(caseWidgetService.getCaseWidget(any(), eq("tab"), eq("widget"))).thenReturn(
            CollectionCaseWidgetDto(
                key = "widget",
                title = "Widget",
                icon = null,
                width = 1,
                highContrast = false,
                isCompact = null,
                properties = CollectionWidgetProperties(
                    collection = "iko:/things",
                    defaultPageSize = 9,
                    title = CollectionWidgetProperties.TitleField("$.name"),
                    fields = listOf(CollectionWidgetProperties.Field("name", "Name", "$.name"))
                )
            )
        )
        whenever(ikoServerRepository.findById(any(), any(), any())).thenReturn(JsonNodeFactory.instance.objectNode())

        factory.createResolver(caseProperties()).apply("/anything")

        assertEquals(
            listOf(ContainerParam("widget", PageRequest.of(0, 9), emptyMap())),
            capturedContainerParams()
        )
    }

    @Test
    fun `should create container param with default page size and no filters for case table widget`() {
        whenever(caseWidgetService.getCaseWidget(any(), eq("tab"), eq("widget"))).thenReturn(
            TableCaseWidgetDto(
                key = "widget",
                title = "Widget",
                icon = null,
                width = 1,
                highContrast = false,
                isCompact = null,
                properties = TableWidgetProperties(
                    collection = "iko:/things",
                    defaultPageSize = 8,
                    columns = listOf(TableWidgetProperties.Column("name", "Name", "$.name"))
                )
            )
        )
        whenever(ikoServerRepository.findById(any(), any(), any())).thenReturn(JsonNodeFactory.instance.objectNode())

        factory.createResolver(caseProperties()).apply("/anything")

        assertEquals(
            listOf(ContainerParam("widget", PageRequest.of(0, 8), emptyMap())),
            capturedContainerParams()
        )
    }

    @Test
    fun `should use iko widget and keep tab key when not in case widget context`() {
        whenever(ikoWidgetService.getByKey("demo", "tab", "widget")).thenReturn(
            InteractiveTableWidget(
                id = UUID.randomUUID(),
                key = "widget",
                title = "Widget",
                order = 0,
                width = 1,
                highContrast = false,
                isCompact = null,
                properties = InteractiveTableWidgetProperties(
                    collection = "iko:/things",
                    defaultPageSize = 11,
                    columns = listOf(InteractiveTableWidgetProperties.Column("name", "Name", "$.name")),
                    filters = listOf(
                        InteractiveTableWidgetProperties.FilterConfig(
                            key = "name",
                            title = "Name",
                            dataType = DataType.TEXT,
                            fieldType = FieldType.SINGLE
                        )
                    )
                )
            )
        )
        whenever(ikoTabService.getIkoTabConfig(any(), anyOrNull())).thenReturn(emptyMap())
        whenever(ikoServerRepository.findById(any(), any(), any())).thenReturn(JsonNodeFactory.instance.objectNode())

        factory.createResolver(
            mapOf(
                IKO_VIEW_KEY to "demo",
                TAB_KEY to "tab",
                WIDGET_KEY to "widget",
                ID to "1",
                "name" to "john",
            )
        ).apply("/anything")

        verify(ikoTabService).getIkoTabConfig("demo", "tab")
        verify(caseWidgetService, never()).getCaseWidget(any(), any(), any())
        assertEquals(
            listOf(ContainerParam("widget", PageRequest.of(0, 11), mapOf("name" to "john"))),
            capturedContainerParams()
        )
    }

    private fun caseProperties(): Map<String, Any> = mapOf(
        DOCUMENT_ID to documentId.toString(),
        TAB_KEY to "tab",
        WIDGET_KEY to "widget",
        IKO_ADP to "adp",
        ID to "1",
        IKO_SERVER_URL to "http://iko",
    )

    private fun capturedContainerParams(): List<ContainerParam> {
        val captor = argumentCaptor<List<ContainerParam>>()
        verify(ikoServerRepository).findById(any(), eq("1"), captor.capture())
        return captor.firstValue
    }

    private fun filter(
        key: String,
        fieldType: FieldType,
        matchType: SearchFieldMatchType? = SearchFieldMatchType.EXACT
    ) = InteractiveTableCaseWidgetProperties.FilterConfig(
        key = key,
        title = key,
        dataType = DataType.TEXT,
        fieldType = fieldType,
        matchType = matchType
    )

    private fun mockWidget(
        filters: List<InteractiveTableCaseWidgetProperties.FilterConfig> = listOf(
            filter("name", FieldType.SINGLE),
            filter("status", FieldType.SINGLE, null)
        )
    ) {
        whenever(caseWidgetService.getCaseWidget(any(), eq("tab"), eq("widget"))).thenReturn(
            InteractiveTableCaseWidgetDto(
                key = "widget",
                title = "Widget",
                icon = null,
                width = 1,
                highContrast = false,
                isCompact = null,
                properties = InteractiveTableCaseWidgetProperties(
                    collection = "iko:/things",
                    defaultPageSize = 15,
                    columns = listOf(InteractiveTableCaseWidgetProperties.Column("name", "Name", "$.name")),
                    filters = filters
                )
            )
        )
    }
}
