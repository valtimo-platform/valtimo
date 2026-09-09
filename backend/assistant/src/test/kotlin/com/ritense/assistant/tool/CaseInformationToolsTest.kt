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

package com.ritense.assistant.tool

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.assistant.web.rest.dto.PageContext
import com.ritense.case.domain.CaseTab
import com.ritense.case.domain.CaseTabId
import com.ritense.case.domain.CaseTabType
import com.ritense.case.service.CaseTabService
import com.ritense.case_.rest.dto.CaseHeaderWidgetDto
import com.ritense.case_.rest.dto.CaseWidgetTabDto
import com.ritense.case_.rest.dto.CaseWidgetTabWidgetDto
import com.ritense.case_.service.CaseHeaderWidgetService
import com.ritense.case_.service.CaseWidgetService
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.impl.JsonSchemaDocumentId
import com.ritense.document.service.DocumentService
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.security.access.AccessDeniedException
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID
import kotlin.test.assertContains
import kotlin.test.assertEquals

class CaseInformationToolsTest {

    private lateinit var documentService: DocumentService
    private lateinit var caseTabService: CaseTabService
    private lateinit var caseWidgetService: CaseWidgetService
    private lateinit var caseHeaderWidgetService: CaseHeaderWidgetService
    private lateinit var objectMapper: ObjectMapper
    private lateinit var tools: CaseInformationTools

    private val sessionId = UUID.randomUUID()
    private val documentId = UUID.randomUUID()

    @BeforeEach
    fun setUp() {
        documentService = mock()
        caseTabService = mock()
        caseWidgetService = mock()
        caseHeaderWidgetService = mock()
        objectMapper = ObjectMapper()

        tools = CaseInformationTools(
            documentService,
            caseTabService,
            caseWidgetService,
            caseHeaderWidgetService,
            objectMapper
        )

        val context = ToolContext(
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token",
            sessionId = sessionId
        )
        ToolContextHolder.set(context)
    }

    @AfterEach
    fun tearDown() {
        ToolContextHolder.clear()
    }

    @Test
    fun `should return case info when user has view permission`() {
        val document = createMockDocument()
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(document))
        whenever(caseHeaderWidgetService.findById(any())).thenReturn(null)
        whenever(caseTabService.getCaseTabs(any<JsonSchemaDocumentId>())).thenReturn(emptyList())

        val result = tools.getCaseInformation(documentId.toString())

        assertContains(result, documentId.toString())
        assertContains(result, "test-case")
        assertContains(result, "metadata")
    }

    @Test
    fun `should return error when user lacks view permission`() {
        whenever(documentService.findBy(any<JsonSchemaDocumentId>()))
            .thenThrow(AccessDeniedException("No access"))

        val result = tools.getCaseInformation(documentId.toString())

        assertEquals("You don't have permission to view this case.", result)
    }

    @Test
    fun `should return error when document not found`() {
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.empty())

        val result = tools.getCaseInformation(documentId.toString())

        assertEquals("Document not found.", result)
    }

    @Test
    fun `should use page context when documentId not provided`() {
        val context = ToolContext(
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token",
            sessionId = sessionId,
            pageContext = PageContext(
                page = "case-detail",
                resourceType = "Case",
                resourceId = documentId.toString()
            )
        )
        ToolContextHolder.set(context)

        val document = createMockDocument()
        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(document))
        whenever(caseHeaderWidgetService.findById(any())).thenReturn(null)
        whenever(caseTabService.getCaseTabs(any<JsonSchemaDocumentId>())).thenReturn(emptyList())

        val result = tools.getCaseInformation(null)

        assertContains(result, documentId.toString())
    }

    @Test
    fun `should return error when no documentId and not on case page`() {
        val context = ToolContext(
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token",
            sessionId = sessionId,
            pageContext = PageContext(
                page = "dashboard",
                resourceType = null,
                resourceId = null
            )
        )
        ToolContextHolder.set(context)

        val result = tools.getCaseInformation(null)

        assertEquals("No document ID provided and not viewing a case.", result)
    }

    @Test
    fun `should return error when no documentId and no page context`() {
        val context = ToolContext(
            userId = "user123",
            userEmail = "user@test.com",
            userRoles = setOf("ROLE_USER"),
            authToken = "token",
            sessionId = sessionId,
            pageContext = null
        )
        ToolContextHolder.set(context)

        val result = tools.getCaseInformation(null)

        assertEquals("No document ID provided and not viewing a case.", result)
    }

    @Test
    fun `should include widget tab data when available`() {
        val document = createMockDocument()
        val caseDefId = CaseDefinitionId("test-case", "1.0.0")
        val caseTab = CaseTab(
            id = CaseTabId(caseDefId, "summary"),
            name = "Summary",
            tabOrder = 0,
            type = CaseTabType.WIDGETS,
            contentKey = "summary"
        )

        val fieldWidget = mock<CaseWidgetTabWidgetDto>()
        whenever(fieldWidget.key).thenReturn("customer-info")
        whenever(fieldWidget.title).thenReturn("Customer Information")

        val widgetTabDto = CaseWidgetTabDto(
            caseDefinitionKey = "test-case",
            caseDefinitionVersionTag = "1.0.0",
            key = "summary",
            widgets = listOf(fieldWidget),
            widgetLayout = null
        )

        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(document))
        whenever(caseHeaderWidgetService.findById(any())).thenReturn(null)
        whenever(caseTabService.getCaseTabs(any<JsonSchemaDocumentId>())).thenReturn(listOf(caseTab))
        whenever(caseWidgetService.getWidgetTab(any<JsonSchemaDocumentId>(), eq("summary"))).thenReturn(widgetTabDto)
        whenever(caseWidgetService.getCaseWidgetData(eq(documentId), eq("summary"), eq("customer-info"), any()))
            .thenReturn(mapOf("customerName" to "John Doe"))

        val result = tools.getCaseInformation(documentId.toString())

        assertContains(result, "Summary")
        assertContains(result, "customer-info")
        assertContains(result, "Customer Information")
        assertContains(result, "John Doe")
    }

    @Test
    fun `should skip widgets user cannot access`() {
        val document = createMockDocument()
        val caseDefId = CaseDefinitionId("test-case", "1.0.0")
        val caseTab = CaseTab(
            id = CaseTabId(caseDefId, "summary"),
            name = "Summary",
            tabOrder = 0,
            type = CaseTabType.WIDGETS,
            contentKey = "summary"
        )

        val fieldWidget = mock<CaseWidgetTabWidgetDto>()
        whenever(fieldWidget.key).thenReturn("restricted-widget")
        whenever(fieldWidget.title).thenReturn("Restricted")

        val widgetTabDto = CaseWidgetTabDto(
            caseDefinitionKey = "test-case",
            caseDefinitionVersionTag = "1.0.0",
            key = "summary",
            widgets = listOf(fieldWidget),
            widgetLayout = null
        )

        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(document))
        whenever(caseHeaderWidgetService.findById(any())).thenReturn(null)
        whenever(caseTabService.getCaseTabs(any<JsonSchemaDocumentId>())).thenReturn(listOf(caseTab))
        whenever(caseWidgetService.getWidgetTab(any<JsonSchemaDocumentId>(), eq("summary"))).thenReturn(widgetTabDto)
        whenever(caseWidgetService.getCaseWidgetData(eq(documentId), eq("summary"), eq("restricted-widget"), any()))
            .thenThrow(AccessDeniedException("No access to widget"))

        val result = tools.getCaseInformation(documentId.toString())

        assertContains(result, "metadata")
    }

    @Test
    fun `should include header widget data when available`() {
        val document = createMockDocument()
        val headerWidgetDto = CaseHeaderWidgetDto(
            caseDefinitionKey = "test-case",
            caseDefinitionVersionTag = "1.0.0",
            type = "highlight",
            highContrast = false,
            properties = mapOf("valuePath" to "doc:/status")
        )

        whenever(documentService.findBy(any<JsonSchemaDocumentId>())).thenReturn(Optional.of(document))
        whenever(caseHeaderWidgetService.findById(any())).thenReturn(headerWidgetDto)
        whenever(caseWidgetService.getCaseHeaderWidgetData(any(), any(), any(), any()))
            .thenReturn(mapOf("value" to "Active"))
        whenever(caseTabService.getCaseTabs(any<JsonSchemaDocumentId>())).thenReturn(emptyList())

        val result = tools.getCaseInformation(documentId.toString())

        assertContains(result, "header")
        assertContains(result, "highlight")
    }

    private fun createMockDocument(): JsonSchemaDocument {
        val document = mock<JsonSchemaDocument>()
        val docId = mock<JsonSchemaDocumentId>()
        val defId = mock<JsonSchemaDocumentDefinitionId>()
        val caseDefId = CaseDefinitionId("test-case", "1.0.0")

        whenever(docId.id).thenReturn(documentId)
        whenever(defId.name()).thenReturn("test-case")
        whenever(defId.caseDefinitionId()).thenReturn(caseDefId)

        whenever(document.id()).thenReturn(docId)
        whenever(document.definitionId()).thenReturn(defId)
        whenever(document.sequence()).thenReturn(1L)
        whenever(document.createdOn()).thenReturn(LocalDateTime.now())
        whenever(document.modifiedOn()).thenReturn(Optional.empty())
        whenever(document.createdBy()).thenReturn("test-user")
        whenever(document.internalStatus()).thenReturn("open")
        whenever(document.assigneeId()).thenReturn(null)
        whenever(document.assigneeFullName()).thenReturn(null)
        whenever(document.assignedTeamKey()).thenReturn(null)
        whenever(document.assignedTeamTitle()).thenReturn(null)

        return document
    }
}
