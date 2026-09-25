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

package com.ritense.case_.web.rest

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case.domain.CaseTabType
import com.ritense.case.service.CaseTabService
import com.ritense.case.web.rest.dto.CaseTabDto
import com.ritense.case_.TestResolverFactory
import com.ritense.case_.rest.dto.CaseWidgetTabDto
import com.ritense.case_.rest.dto.CaseWidgetTabWidgetDto
import com.ritense.case_.service.CaseWidgetService
import com.ritense.case_.widget.fields.FieldsCaseWidgetDto
import com.ritense.case_.widget.table.TableCaseWidgetDto
import com.ritense.case_.widget.table.TableWidgetProperties
import com.ritense.case_.widget.fields.FieldsWidgetProperties
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.DEVELOPER
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.reset
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.MvcResult
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext
import java.util.UUID

@Transactional
class CaseWidgetDataGroupResourceIntTest @Autowired constructor(
    private val webApplicationContext: WebApplicationContext,
    private val tabService: CaseTabService,
    private val widgetTabService: CaseWidgetService,
    private val testValueResolverFactory: TestResolverFactory,
) : BaseIntegrationTest() {

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should expose a shared data group id for widgets with the same dependency`() {
        val documentId = createCase()

        mockMvc.perform(widgetTabRequest(documentId))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.widgets[0].dataGroupId").exists())
            .andExpect(jsonPath("$.widgets[1].dataGroupId").exists())

        val groupIds = dataGroupIds(documentId)
        assert(groupIds[0] == groupIds[1]) { "Expected one group for both widgets, got $groupIds" }
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should serve every widget of a group with one document fetch`() {
        val documentId = createCase()
        val group = dataGroupIds(documentId).first()
        reset(testValueResolverFactory)

        mockMvc.perform(dataGroupRequest(documentId, group))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.first-widget.data.someKey").value("test:someValue"))
            .andExpect(jsonPath("$.second-widget.data.otherKey").value("test:otherValue"))
            .andExpect(jsonPath("$.first-widget.error").doesNotExist())

        verify(testValueResolverFactory, times(1)).createResolver(documentId.toString())
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should keep a paged widget out of the field widgets' group`() {
        val documentId = createCaseWithTable()

        val groupIds = dataGroupIds(documentId)

        assertThat(groupIds).hasSize(3)
        assertThat(groupIds[0]).isEqualTo(groupIds[1])
        assertThat(groupIds[2]).isNotIn(groupIds[0], groupIds[1])
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should not serve a paged widget from the field widgets' group`() {
        val documentId = createCaseWithTable()
        val fieldGroup = dataGroupIds(documentId).first()

        mockMvc.perform(dataGroupRequest(documentId, fieldGroup))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.first-widget").exists())
            .andExpect(jsonPath("$.second-widget").exists())
            .andExpect(jsonPath("$.table-widget").doesNotExist())
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should return 404 for an unknown data group`() {
        val documentId = createCase()

        mockMvc.perform(dataGroupRequest(documentId, "unknown"))
            .andDo(print())
            .andExpect(status().isNotFound)
    }

    @Test
    @WithMockUser(username = "developer@ritense.com", authorities = [DEVELOPER])
    fun `should deny access to a data group when not authorized`() {
        val documentId = runWithoutAuthorization { createCase() }
        val group = runWithoutAuthorization { dataGroupIds(documentId).first() }

        mockMvc.perform(dataGroupRequest(documentId, group))
            .andDo(print())
            .andExpect(status().isForbidden)
    }

    private fun dataGroupIds(documentId: UUID): List<String> {
        val result: MvcResult = mockMvc.perform(widgetTabRequest(documentId)).andReturn()
        val widgets = MapperSingleton.get()
            .readTree(result.response.contentAsString)
            .get("widgets")
        return widgets.map { it.get("dataGroupId").asText() }
    }

    private fun widgetTabRequest(documentId: UUID) =
        get("/api/v1/document/{documentId}/widget-tab/{tabKey}", documentId, TAB_KEY)
            .contentType(MediaType.APPLICATION_JSON_VALUE)

    private fun dataGroupRequest(documentId: UUID, group: String) =
        get("/api/v1/document/{documentId}/widget-tab/{tabKey}/data", documentId, TAB_KEY)
            .param("group", group)
            .contentType(MediaType.APPLICATION_JSON_VALUE)

    private fun createCaseWithTable(): UUID = createCase(
        listOf(
            fieldsWidget("first-widget", "someKey", "test:someValue"),
            fieldsWidget("second-widget", "otherKey", "test:otherValue"),
            TableCaseWidgetDto(
                key = "table-widget",
                title = "table-widget",
                icon = null,
                width = 1,
                highContrast = false,
                isCompact = null,
                properties = TableWidgetProperties(
                    collection = "test:someCollection",
                    defaultPageSize = 5,
                    columns = listOf(TableWidgetProperties.Column("someKey", "Some key", "/someKey")),
                )
            ),
        )
    )

    private fun createCase(
        widgets: List<CaseWidgetTabWidgetDto> = listOf(
            fieldsWidget("first-widget", "someKey", "test:someValue"),
            fieldsWidget("second-widget", "otherKey", "test:otherValue"),
        )
    ): UUID = runWithoutAuthorization {
        val document = documentService.createDocument(
            NewDocumentRequest(
                CASE_DEFINITION_NAME,
                CASE_DEFINITION_NAME,
                "1.2.3",
                MapperSingleton.get().createObjectNode()
            )
        ).resultingDocument().get()
        createCaseWidgetTab(document.definitionId().caseDefinitionId(), widgets)
        document.id().id
    }

    private fun createCaseWidgetTab(caseDefinitionId: CaseDefinitionId, widgets: List<CaseWidgetTabWidgetDto>) {
        tabService.createCaseTab(
            caseDefinitionId,
            CaseTabDto(key = TAB_KEY, type = CaseTabType.WIDGETS, contentKey = "-")
        )
        widgetTabService.updateWidgetTab(
            CaseWidgetTabDto(
                caseDefinitionKey = caseDefinitionId.key,
                caseDefinitionVersionTag = caseDefinitionId.versionTag.version,
                TAB_KEY,
                widgets = widgets
            )
        )
    }

    private fun fieldsWidget(key: String, fieldKey: String, value: String) = FieldsCaseWidgetDto(
        key = key,
        title = key,
        icon = null,
        width = 1,
        highContrast = false,
        isCompact = null,
        properties = FieldsWidgetProperties(
            columns = listOf(
                listOf(FieldsWidgetProperties.Field(key = fieldKey, title = fieldKey, value = value))
            )
        )
    )

    private companion object {
        const val CASE_DEFINITION_NAME = "some-case-type"
        const val TAB_KEY = "my-tab"
    }
}
