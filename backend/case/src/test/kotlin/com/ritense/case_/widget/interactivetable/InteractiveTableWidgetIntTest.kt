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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.domain.CaseTabType
import com.ritense.case.service.CaseTabService
import com.ritense.case.web.rest.dto.CaseTabDto
import com.ritense.case_.TestResolverFactory
import com.ritense.case_.rest.dto.CaseWidgetTabDto
import com.ritense.case_.service.CaseWidgetService
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.search.domain.DataType
import com.ritense.search.domain.FieldType
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.PAGEABLE
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.TAB_KEY
import com.ritense.valueresolver.ValueResolverPropertyKey.Companion.WIDGET_KEY
import com.ritense.widget.domain.NavigateToWidgetAction
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.assertj.core.api.Assertions.assertThat
import org.mockito.kotlin.argThat
import org.mockito.kotlin.atLeastOnce
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.http.MediaType
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext
import java.util.UUID
import java.util.function.Function

@Transactional
class InteractiveTableWidgetIntTest @Autowired constructor(
    private val webApplicationContext: WebApplicationContext,
    private val tabService: CaseTabService,
    private val widgetTabService: CaseWidgetService,
    private val testValueResolverFactory: TestResolverFactory,
    private val objectMapper: ObjectMapper
) : BaseIntegrationTest() {

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should find case widget tab with interactive table`() {
        val documentId = createDocumentWithWidget()

        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}", documentId, TAB_KEY_VALUE)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.widgets[0].type").value("interactive-table"))
            .andExpect(jsonPath("$.widgets[0].properties.collection").value("test:myCollection"))
            .andExpect(jsonPath("$.widgets[0].properties.defaultPageSize").value(3))
            .andExpect(jsonPath("$.widgets[0].properties.columns[0].key").value("name"))
            .andExpect(jsonPath("$.widgets[0].properties.columns[0].sortable").value(true))
            .andExpect(jsonPath("$.widgets[0].properties.filters[0].key").value("status"))
            .andExpect(jsonPath("$.widgets[0].properties.rowClickAction.navigateTo").value("/iko/demo/\${\$.id}"))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should get paged interactive table data and forward filters to the resolver`() {
        val documentId = createDocumentWithWidget()
        whenever(testValueResolverFactory.createResolver(documentId.toString())).thenReturn(Function { placeholder ->
            if (placeholder == "myCollection") {
                mapOf(
                    "content" to listOf(
                        mapOf("id" to "1", "name" to "x"),
                        mapOf("id" to "2", "name" to "y")
                    ),
                    "totalElements" to 42
                )
            } else {
                null
            }
        })

        mockMvc.perform(
            get(
                "/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}",
                documentId, TAB_KEY_VALUE, WIDGET_KEY_VALUE
            )
                .param("page", "1")
                .param("size", "2")
                .param("status", "open")
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.table.totalElements").value(42))
            .andExpect(jsonPath("$.table.number").value(1))
            .andExpect(jsonPath("$.table.size").value(2))
            .andExpect(jsonPath("$.table.content[0].data.name").value("x"))
            .andExpect(jsonPath("$.table.content[1].data.name").value("y"))
            .andExpect(jsonPath("$.table.content[0].resolved['/iko/demo/\${\$.id}']").value("/iko/demo/1"))
            .andExpect(jsonPath("$.table.content[1].resolved['/iko/demo/\${\$.id}']").value("/iko/demo/2"))

        verify(testValueResolverFactory, atLeastOnce()).createResolver(argThat<Map<String, Any>> {
            this["status"] == "open" && this[TAB_KEY] == TAB_KEY_VALUE && this[WIDGET_KEY] == WIDGET_KEY_VALUE
        })
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should use default page size when no size is requested`() {
        val documentId = createDocumentWithWidget()
        whenever(testValueResolverFactory.createResolver(documentId.toString())).thenReturn(Function { null })

        mockMvc.perform(
            get(
                "/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}",
                documentId, TAB_KEY_VALUE, WIDGET_KEY_VALUE
            ).contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.table.size").value(3))
            .andExpect(jsonPath("$.table.totalElements").value(0))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should use default page size when size zero is requested`() {
        val documentId = createDocumentWithWidget()
        whenever(testValueResolverFactory.createResolver(documentId.toString())).thenReturn(Function { null })

        mockMvc.perform(
            get(
                "/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}",
                documentId, TAB_KEY_VALUE, WIDGET_KEY_VALUE
            ).param("size", "0").contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.table.size").value(3))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should prefer requested page size over default page size`() {
        val documentId = createDocumentWithWidget()
        whenever(testValueResolverFactory.createResolver(documentId.toString())).thenReturn(Function { null })

        mockMvc.perform(
            get(
                "/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}",
                documentId, TAB_KEY_VALUE, WIDGET_KEY_VALUE
            ).param("size", "4").contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.table.size").value(4))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should forward multi value filter as list to the resolver`() {
        val documentId = createDocumentWithWidget()
        whenever(testValueResolverFactory.createResolver(documentId.toString())).thenReturn(Function { null })

        mockMvc.perform(
            get(
                "/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}",
                documentId, TAB_KEY_VALUE, WIDGET_KEY_VALUE
            ).param("status", "open", "closed").contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isOk)

        verify(testValueResolverFactory, atLeastOnce()).createResolver(argThat<Map<String, Any>> {
            this["status"] == listOf("open", "closed")
        })
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should forward range filter as raw json string to the resolver`() {
        val documentId = createDocumentWithWidget()
        whenever(testValueResolverFactory.createResolver(documentId.toString())).thenReturn(Function { null })
        val range = """{"rangeFrom":"2024-01-01"}"""

        mockMvc.perform(
            get(
                "/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}",
                documentId, TAB_KEY_VALUE, WIDGET_KEY_VALUE
            ).param("created", range).contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isOk)

        verify(testValueResolverFactory, atLeastOnce()).createResolver(argThat<Map<String, Any>> {
            this["created"] == range
        })
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should forward sort to the resolver as pageable`() {
        val documentId = createDocumentWithWidget()
        whenever(testValueResolverFactory.createResolver(documentId.toString())).thenReturn(Function { null })

        mockMvc.perform(
            get(
                "/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}",
                documentId, TAB_KEY_VALUE, WIDGET_KEY_VALUE
            ).param("sort", "name,DESC").contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isOk)

        verify(testValueResolverFactory, atLeastOnce()).createResolver(argThat<Map<String, Any>> {
            (this[PAGEABLE] as? Pageable)?.sort?.getOrderFor("name")?.direction == Sort.Direction.DESC
        })
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = ["ROLE_NO_ACCESS"])
    fun `should deny interactive table data without permission`() {
        val documentId = createDocumentWithWidget()

        assertThrows<AccessDeniedException> {
            widgetTabService.getCaseWidgetData(documentId, TAB_KEY_VALUE, WIDGET_KEY_VALUE, Pageable.ofSize(5))
        }
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should import and update interactive table widget from json`() {
        runWithoutAuthorization {
            val caseDefinitionId = documentService.createDocument(
                NewDocumentRequest(CASE_NAME, CASE_NAME, "1.2.3", MapperSingleton.get().createObjectNode())
            ).resultingDocument().get().definitionId().caseDefinitionId()
            tabService.createCaseTab(
                caseDefinitionId,
                CaseTabDto(key = TAB_KEY_VALUE, type = CaseTabType.WIDGETS, contentKey = "-")
            )
            val tabDto = objectMapper.readValue(
                """
                {
                  "key": "$TAB_KEY_VALUE",
                  "caseDefinitionKey": "${caseDefinitionId.key}",
                  "caseDefinitionVersionTag": "${caseDefinitionId.versionTag.version}",
                  "widgets": [{
                    "type": "interactive-table",
                    "key": "$WIDGET_KEY_VALUE",
                    "title": "Json widget",
                    "width": 1,
                    "highContrast": false,
                    "properties": {
                      "collection": "iko:/things",
                      "defaultPageSize": 10,
                      "columns": [{"key": "name", "title": "Name", "value": "$.name", "sortable": true}],
                      "filters": [{"key": "name", "title": "Name", "dataType": "text", "fieldType": "single"}],
                      "rowClickAction": {"name": null, "navigateTo": "/iko/demo/1"}
                    }
                  }]
                }
                """.trimIndent(),
                CaseWidgetTabDto::class.java
            )

            val updated = widgetTabService.updateWidgetTab(tabDto)

            val widget = updated.widgets.single() as InteractiveTableCaseWidgetDto
            assertThat(widget.properties.columns.single().sortable).isTrue()
            assertThat(widget.properties.filters.single().fieldType).isEqualTo(FieldType.SINGLE)
            assertThat(widget.properties.rowClickAction).isEqualTo(NavigateToWidgetAction(null, "/iko/demo/1"))
        }
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should assign a data group id to the interactive table widget`() {
        val documentId = createDocumentWithWidget()

        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}", documentId, TAB_KEY_VALUE)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.widgets[0].dataGroupId").isNotEmpty)

        val groupIds = runWithoutAuthorization { widgetTabService.dataGroupIds(documentId, TAB_KEY_VALUE) }
        assertThat(groupIds[WIDGET_KEY_VALUE]).isNotNull()
        assertThat(groupIds.values.toSet()).hasSameSizeAs(groupIds.keys)
    }

    private fun createDocumentWithWidget(defaultPageSize: Int = 3): UUID = runWithoutAuthorization {
        val document = documentService.createDocument(
            NewDocumentRequest(
                CASE_NAME,
                CASE_NAME,
                "1.2.3",
                MapperSingleton.get().createObjectNode()
            )
        ).resultingDocument().get()
        createCaseWidgetTab(document.definitionId().caseDefinitionId(), defaultPageSize)
        document.id.id
    }

    private fun createCaseWidgetTab(caseDefinitionId: CaseDefinitionId, defaultPageSize: Int): CaseWidgetTabDto {
        tabService.createCaseTab(
            caseDefinitionId,
            CaseTabDto(key = TAB_KEY_VALUE, type = CaseTabType.WIDGETS, contentKey = "-")
        )
        return widgetTabService.updateWidgetTab(
            CaseWidgetTabDto(
                caseDefinitionKey = caseDefinitionId.key,
                caseDefinitionVersionTag = caseDefinitionId.versionTag.version,
                key = TAB_KEY_VALUE,
                widgets = listOf(
                    InteractiveTableCaseWidgetDto(
                        key = WIDGET_KEY_VALUE,
                        title = "My widget",
                        icon = "mdi-home",
                        color = null,
                        width = 1,
                        highContrast = true,
                        isCompact = true,
                        actions = null,
                        displayConditions = emptyList(),
                        properties = InteractiveTableCaseWidgetProperties(
                            collection = "test:myCollection",
                            defaultPageSize = defaultPageSize,
                            columns = listOf(
                                InteractiveTableCaseWidgetProperties.Column(
                                    key = "name",
                                    title = "Name",
                                    value = "$.name",
                                    sortable = true
                                )
                            ),
                            filters = listOf(
                                InteractiveTableCaseWidgetProperties.FilterConfig(
                                    key = "status",
                                    title = "Status",
                                    dataType = DataType.TEXT,
                                    fieldType = FieldType.SINGLE
                                )
                            ),
                            rowClickAction = NavigateToWidgetAction(
                                name = null,
                                navigateTo = "/iko/demo/\${\$.id}"
                            )
                        )
                    )
                )
            )
        )
    }

    private companion object {
        const val CASE_NAME = "some-case-type"
        const val TAB_KEY_VALUE = "my-tab"
        const val WIDGET_KEY_VALUE = "my-widget"
    }
}
