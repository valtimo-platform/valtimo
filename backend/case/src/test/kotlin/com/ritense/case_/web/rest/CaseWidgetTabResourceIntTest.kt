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
import com.ritense.case_.rest.dto.CaseWidgetTabDto
import com.ritense.case_.service.CaseWidgetService
import com.ritense.case_.web.rest.dto.TestCaseWidgetTabWidgetDto
import com.ritense.case_.widget.TestCaseWidgetProperties
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.DEVELOPER
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.conditions.Condition
import com.ritense.valtimo.contract.repository.ExpressionOperator
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.widget.displayproperties.CurrencyFieldDisplayProperties
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext
import java.util.UUID

@Transactional
class CaseWidgetTabResourceIntTest @Autowired constructor(
    private val webApplicationContext: WebApplicationContext,
    private val tabService: CaseTabService,
    private val widgetTabService: CaseWidgetService,
) : BaseIntegrationTest() {

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should not find case widget tab`() {
        val documentId = UUID.randomUUID().toString()
        val tabKey = "fake-tab"
        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}", documentId, tabKey)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andExpect(status().isNotFound)
    }

    @Test
    @WithMockUser(username = "developer@ritense.com", authorities = [DEVELOPER])
    fun `should deny access to widget tab when not authorized`() {
        val caseDefinitionName = "some-case-type"
        val tabKey = "my-tab"
        val widgetKey = "my-widget"
        val documentId = runWithoutAuthorization {
            val document = documentService.createDocument(
                NewDocumentRequest(
                    caseDefinitionName,
                    caseDefinitionName,
                    "1.2.3",
                    MapperSingleton.get().createObjectNode()
                )
            ).resultingDocument().get()
            createCaseWidgetTab(document.definitionId().caseDefinitionId(), tabKey, widgetKey)
            document.id()
        }
        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}", documentId, tabKey)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should find case widget tab`() {
        val caseDefinitionName = "some-case-type"
        val tabKey = "my-tab"
        val widgetKey = "my-widget"
        val documentId = runWithoutAuthorization {
            val document = documentService.createDocument(
                NewDocumentRequest(
                    caseDefinitionName,
                    caseDefinitionName,
                    "1.2.3",
                    MapperSingleton.get().createObjectNode()
                )
            ).resultingDocument().get()
            createCaseWidgetTab(document.definitionId().caseDefinitionId(), tabKey, widgetKey)
            document.id
        }
        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}", documentId, tabKey)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.caseDefinitionKey").value(caseDefinitionName))
            .andExpect(jsonPath("$.caseDefinitionVersionTag").value("1.2.3"))
            .andExpect(jsonPath("$.key").value(tabKey))
            .andExpect(jsonPath("$.widgets").exists())
            .andExpect(jsonPath("$.widgets[0].type").value("test"))
            .andExpect(jsonPath("$.widgets[0].key").value("my-widget"))
            .andExpect(jsonPath("$.widgets[0].width").value("1"))
            .andExpect(jsonPath("$.widgets[0].highContrast").value(true))
    }

    @Test
    @WithMockUser(username = "developer@ritense.com", authorities = [DEVELOPER])
    fun `should deny access to case widget data when not authorized`() {
        val caseDefinitionName = "some-case-type"
        val tabKey = "my-tab"
        val widgetKey = "my-widget"
        val documentId = runWithoutAuthorization {
            val document = documentService.createDocument(
                NewDocumentRequest(
                    caseDefinitionName,
                    caseDefinitionName,
                    "1.2.3",
                    MapperSingleton.get().createObjectNode()
                )
            ).resultingDocument().get()
            createCaseWidgetTab(document.definitionId().caseDefinitionId(), tabKey, widgetKey)
            document.id
        }
        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}", documentId, tabKey, widgetKey)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should get case widget data`() {
        val caseDefinitionName = "some-case-type"
        val tabKey = "my-tab"
        val widgetKey = "my-widget"
        val documentId = runWithoutAuthorization {
            val document = documentService.createDocument(
                NewDocumentRequest(
                    caseDefinitionName,
                    caseDefinitionName,
                    "1.2.3",
                    MapperSingleton.get().createObjectNode()
                )
            ).resultingDocument().get()
            createCaseWidgetTab(document.definitionId().caseDefinitionId(), tabKey, widgetKey)
            document.id
        }
        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}", documentId, tabKey, widgetKey)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.test").value("test123"))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = ["ROLE_ALL_WIDGETS"])
    fun `should deny widget endpoints without document view permission`() {
        val documentId = createDocumentWithWidgetTab()
        val groupId = runWithoutAuthorization { widgetTabService.dataGroupIds(documentId, "my-tab") }["my-widget"]

        mockMvc.perform(get("/api/v1/document/{documentId}/widget-tab/{tabKey}", documentId, "my-tab"))
            .andExpect(status().isForbidden)
        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}", documentId, "my-tab", "my-widget")
        ).andExpect(status().isForbidden)
        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}/data", documentId, "my-tab")
                .param("group", groupId ?: "group")
        ).andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = ["ROLE_OWN_DOCUMENT_WIDGETS"])
    fun `should only allow widget endpoints for documents the user may view`() {
        val ownDocumentId = createDocumentWithWidgetTab("""{"key": "OWN"}""")
        val otherDocumentId = createDocumentOnly("""{"key": "OTHER"}""")

        mockMvc.perform(get("/api/v1/document/{documentId}/widget-tab/{tabKey}", ownDocumentId, "my-tab"))
            .andExpect(status().isOk)
        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}", ownDocumentId, "my-tab", "my-widget")
        ).andExpect(status().isOk)
            .andExpect(jsonPath("$.test").value("test123"))

        mockMvc.perform(get("/api/v1/document/{documentId}/widget-tab/{tabKey}", otherDocumentId, "my-tab"))
            .andExpect(status().isForbidden)
        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}", otherDocumentId, "my-tab", "my-widget")
        ).andExpect(status().isForbidden)
        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}/data", otherDocumentId, "my-tab")
                .param("group", "group")
        ).andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should not find hidden case widget data`() {
        val documentId = createDocumentWithWidgetTab(
            displayConditions = listOf(Condition("test:test", ExpressionOperator.EQUAL_TO, "not test"))
        )

        mockMvc.perform(
            get("/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}", documentId, "my-tab", "my-widget")
        ).andExpect(status().isNotFound)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should not find case widget data for unknown document`() {
        mockMvc.perform(
            get(
                "/api/v1/document/{documentId}/widget-tab/{tabKey}/widget/{widgetKey}",
                UUID.randomUUID(), "my-tab", "my-widget"
            )
        ).andExpect(status().isNotFound)
    }

    private fun createDocumentWithWidgetTab(
        content: String = "{}",
        displayConditions: List<Condition<*>> = emptyList()
    ): UUID = runWithoutAuthorization {
        val document = documentService.createDocument(
            NewDocumentRequest(
                "some-case-type",
                "some-case-type",
                "1.2.3",
                MapperSingleton.get().readTree(content)
            )
        ).resultingDocument().get()
        createCaseWidgetTab(document.definitionId().caseDefinitionId(), "my-tab", "my-widget", displayConditions)
        document.id().id
    }

    private fun createDocumentOnly(content: String): UUID = runWithoutAuthorization {
        documentService.createDocument(
            NewDocumentRequest("some-case-type", "some-case-type", "1.2.3", MapperSingleton.get().readTree(content))
        ).resultingDocument().get().id().id
    }

    private fun createCaseWidgetTab(
        caseDefinitionId: CaseDefinitionId,
        tabKey: String,
        widgetKey: String,
        displayConditions: List<Condition<*>> = emptyList()
    ): CaseWidgetTabDto {
        tabService.createCaseTab(
            caseDefinitionId,
            CaseTabDto(key = tabKey, type = CaseTabType.WIDGETS, contentKey = "-")
        )
        return widgetTabService.updateWidgetTab(
            CaseWidgetTabDto(
                caseDefinitionKey = caseDefinitionId.key,
                caseDefinitionVersionTag = caseDefinitionId.versionTag.version,
                tabKey,
                widgets = listOf(
                    TestCaseWidgetTabWidgetDto(
                        key = widgetKey,
                        title = "My widget",
                        icon = "mdi-home",
                        color = null,
                        width = 1,
                        highContrast = true,
                        isCompact = true,
                        properties = TestCaseWidgetProperties(
                            displayProperties = CurrencyFieldDisplayProperties(
                                currencyCode = "EUR"
                            )
                        ),
                        displayConditions = displayConditions
                    )
                )
            )
        )
    }
}
