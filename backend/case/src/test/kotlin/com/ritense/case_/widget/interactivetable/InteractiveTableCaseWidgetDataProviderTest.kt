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

package com.ritense.case_.widget.interactivetable

import com.fasterxml.jackson.databind.JsonNode
import com.ritense.case_.domain.tab.CaseWidgetTabWidgetId
import com.ritense.case_.widget.exception.InvalidCollectionException
import com.ritense.case_.widget.exception.InvalidCollectionNodeTypeException
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.DOCUMENT_ID
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.NO_PAGE_SIZE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import com.ritense.valueresolver.ValueResolverService
import com.ritense.widget.domain.NavigateToWidgetAction
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.capture
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.data.domain.Pageable
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class InteractiveTableCaseWidgetDataProviderTest(
    @Mock private val valueResolverService: ValueResolverService
) {

    private val objectMapper = MapperSingleton.get()
    private val provider = InteractiveTableCaseWidgetDataProvider(objectMapper, valueResolverService)
    private val caseDefinitionId = CaseDefinitionId("test-case", "1.0.0")
    private val documentId = UUID.randomUUID()

    @Test
    fun `should return empty page when collection is null`() {
        val widget = testWidget()
        mockResolved(widget, null)

        val result = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)

        assertThat(result.table.content).isEmpty()
        assertThat(result.table.totalElements).isZero()
    }

    @Test
    fun `should page an in-memory array collection`() {
        val widget = testWidget()
        mockResolved(widget, listOf(row("a", 1), row("b", 2), row("c", 3)))

        val first = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)
        val second = provider.getData(documentId, widget, Pageable.ofSize(2).withPage(1), caseDefinitionId)

        assertThat(first.table.content.map { it.data }).containsExactly(
            mapOf("name" to "a", "count" to 1),
            mapOf("name" to "b", "count" to 2)
        )
        assertThat(first.table.totalElements).isEqualTo(3)
        assertThat(second.table.content.map { it.data["name"] }).containsExactly("c")
    }

    @Test
    fun `should use content and totalElements of already paged collection`() {
        val widget = testWidget()
        mockResolved(widget, mapOf("content" to listOf(row("a", 1)), "totalElements" to 42))

        val result = provider.getData(documentId, widget, Pageable.ofSize(2).withPage(3), caseDefinitionId)

        assertThat(result.table.content.map { it.data["name"] }).containsExactly("a")
        assertThat(result.table.totalElements).isEqualTo(42)
    }

    @Test
    fun `should use default page size when no page size was requested`() {
        val widget = testWidget(defaultPageSize = 2)
        mockResolved(widget, listOf(row("a", 1), row("b", 2), row("c", 3)))

        val result = provider.getData(
            documentId,
            widget,
            Pageable.ofSize(5),
            caseDefinitionId,
            mapOf(NO_PAGE_SIZE to true)
        )

        assertThat(result.table.size).isEqualTo(2)
        assertThat(result.table.content).hasSize(2)
    }

    @Test
    fun `should keep requested page size when page size was requested`() {
        val widget = testWidget(defaultPageSize = 2)
        mockResolved(widget, listOf(row("a", 1), row("b", 2), row("c", 3)))

        val result = provider.getData(
            documentId,
            widget,
            Pageable.ofSize(3),
            caseDefinitionId,
            mapOf(NO_PAGE_SIZE to false)
        )

        assertThat(result.table.size).isEqualTo(3)
        assertThat(result.table.content).hasSize(3)
    }

    @Test
    fun `should forward request properties to value resolver`() {
        val widget = testWidget()
        mockResolved(widget, emptyList<Any>())
        val pageable = Pageable.ofSize(2)

        provider.getData(
            documentId,
            widget,
            pageable,
            caseDefinitionId,
            mapOf("status" to "open", TAB_KEY to "tab", WIDGET_KEY to "widget", NO_PAGE_SIZE to false)
        )

        @Suppress("UNCHECKED_CAST")
        val captor = ArgumentCaptor.forClass(Map::class.java) as ArgumentCaptor<Map<String, Any>>
        verify(valueResolverService).resolveValues(capture(captor), any<Collection<String>>())
        assertThat(captor.value)
            .containsEntry("status", "open")
            .containsEntry(TAB_KEY, "tab")
            .containsEntry(WIDGET_KEY, "widget")
            .containsEntry(DOCUMENT_ID, documentId.toString())
            .containsEntry(PAGEABLE, pageable)
    }

    @Test
    fun `should resolve row click action through json path and resolver placeholder`() {
        val widget = testWidget(
            rowClickAction = NavigateToWidgetAction(
                name = null,
                navigateTo = "/iko/demo/\${\$.id}/details/\${test:fixed}"
            )
        )
        mockResolved(widget, listOf(mapOf("id" to "7", "name" to "a")), "test:fixed" to "x")

        val result = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)

        assertThat(result.table.content.single().resolved)
            .containsEntry("/iko/demo/\${\$.id}/details/\${test:fixed}", "/iko/demo/7/details/x")
    }

    @Test
    fun `should have null row resolved when there is no row click action`() {
        val widget = testWidget()
        mockResolved(widget, listOf(row("a", 1)))

        val result = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)

        assertThat(result.table.content.single().resolved).isNull()
    }

    @Test
    fun `should throw when collection is not a collection`() {
        val widget = testWidget()
        mockResolved(widget, "justAString")

        assertThrows<InvalidCollectionException> {
            provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)
        }
    }

    @Test
    fun `should throw when collection node is not a container`() {
        val widget = testWidget()
        mockResolved(widget, listOf(row("a", 1), ""))

        assertThrows<InvalidCollectionNodeTypeException> {
            provider.getData(documentId, widget, Pageable.ofSize(5), caseDefinitionId)
        }
    }

    @Test
    fun `should resolve JsonNode collection`() {
        val widget = testWidget()
        mockResolved(widget, objectMapper.valueToTree<JsonNode>(listOf(row("a", 1))))

        val result = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)

        assertThat(result.table.content.single().data).containsEntry("name", "a")
    }

    @Test
    fun `should read nested value with json path`() {
        val widget = testWidget(columns = listOf(column("v", "$.a.b")))
        mockResolved(widget, listOf(mapOf("a" to mapOf("b" to "deep"))))

        val result = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)

        assertThat(result.table.content.single().data).containsEntry("v", "deep")
    }

    @Test
    fun `should read nested value with json pointer without leading slash`() {
        val widget = testWidget(columns = listOf(column("v", "a/b")))
        mockResolved(widget, listOf(mapOf("a" to mapOf("b" to "deep"))))

        val result = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)

        assertThat(result.table.content.single().data).containsEntry("v", "deep")
    }

    @Test
    fun `should read nested value with json pointer with leading slash`() {
        val widget = testWidget(columns = listOf(column("v", "/a/b")))
        mockResolved(widget, listOf(mapOf("a" to mapOf("b" to "deep"))))

        val result = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)

        assertThat(result.table.content.single().data).containsEntry("v", "deep")
    }

    @Test
    fun `should return null when json pointer points to an object node`() {
        val widget = testWidget(columns = listOf(column("v", "/a")))
        mockResolved(widget, listOf(mapOf("a" to mapOf("b" to "deep"))))

        val result = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)

        assertThat(result.table.content.single().data).containsEntry("v", null)
    }

    @Test
    fun `should return null when json pointer path is missing`() {
        val widget = testWidget(columns = listOf(column("v", "/x/y")))
        mockResolved(widget, listOf(mapOf("a" to mapOf("b" to "deep"))))

        val result = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)

        assertThat(result.table.content.single().data).containsEntry("v", null)
    }

    @Test
    fun `should return null when json path is missing`() {
        val widget = testWidget(columns = listOf(column("v", "$.x.y")))
        mockResolved(widget, listOf(mapOf("a" to mapOf("b" to "deep"))))

        val result = provider.getData(documentId, widget, Pageable.ofSize(2), caseDefinitionId)

        assertThat(result.table.content.single().data).containsEntry("v", null)
    }

    private fun column(key: String, value: String) = InteractiveTableCaseWidgetProperties.Column(key, key, value)

    private fun row(name: String, count: Int) = mapOf("name" to name, "count" to count)

    private fun mockResolved(
        widget: InteractiveTableCaseWidget,
        collection: Any?,
        vararg extra: Pair<String, Any?>
    ) {
        whenever(valueResolverService.resolveValues(any<Map<String, Any>>(), any<Collection<String>>())).thenReturn(
            mapOf(widget.properties.collection to collection) + extra
        )
    }

    private fun testWidget(
        defaultPageSize: Int = 2,
        rowClickAction: NavigateToWidgetAction? = null,
        columns: List<InteractiveTableCaseWidgetProperties.Column> = listOf(
            InteractiveTableCaseWidgetProperties.Column("name", "Name", "$.name"),
            InteractiveTableCaseWidgetProperties.Column("count", "Count", "/count"),
        )
    ) = InteractiveTableCaseWidget(
        id = CaseWidgetTabWidgetId("test"),
        title = "Test",
        order = 0,
        width = 1,
        highContrast = true,
        isCompact = true,
        actions = emptyList(),
        displayConditions = emptyList(),
        properties = InteractiveTableCaseWidgetProperties(
            collection = "test:someCollection",
            defaultPageSize = defaultPageSize,
            columns = columns,
            rowClickAction = rowClickAction
        )
    )
}
