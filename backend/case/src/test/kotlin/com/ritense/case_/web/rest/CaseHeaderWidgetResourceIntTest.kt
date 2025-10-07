package com.ritense.case_.web.rest

import com.fasterxml.jackson.databind.node.ObjectNode
import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.domain.header.CaseHeaderWidget
import com.ritense.case_.domain.header.CaseHeaderWidgetId
import com.ritense.case_.repository.CaseHeaderWidgetRepository
import com.ritense.case_.service.CaseWidgetService
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.DEVELOPER
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import com.ritense.valtimo.contract.json.MapperSingleton
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.Mockito
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
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

@Transactional
@Import(CaseHeaderWidgetResourceIntTest.MockConfig::class)
class CaseHeaderWidgetResourceIntTest @Autowired constructor(
    private val webApplicationContext: WebApplicationContext,
    private val caseHeaderWidgetRepository: CaseHeaderWidgetRepository,
    private val caseWidgetService: CaseWidgetService
) : BaseIntegrationTest() {

    private lateinit var mockMvc: MockMvc
    private val mapper = MapperSingleton.get()

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should return no content when header widget not found`() {
        val documentId = createDocumentOnly()

        mockMvc.perform(
            get("/api/v1/case/{documentId}/header-widget", documentId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isNoContent)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should return not found for header widget data when widget missing`() {
        val documentId = createDocumentOnly()

        mockMvc.perform(
            get("/api/v1/case/{documentId}/header-widget/data", documentId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isNotFound)
    }

    @Test
    @WithMockUser(username = "developer@ritense.com", authorities = [DEVELOPER])
    fun `should deny access to header widget when not authorized`() {
        val docId = createDocumentAndPersistHeaderWidget()

        mockMvc.perform(
            get("/api/v1/case/{documentId}/header-widget", docId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "developer@ritense.com", authorities = [DEVELOPER])
    fun `should deny access to header widget data when not authorized`() {
        val docId = createDocumentAndPersistHeaderWidget()

        mockMvc.perform(
            get("/api/v1/case/{documentId}/header-widget/data", docId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should get header widget`() {
        val (docId, widgetType, highContrast) = createDocumentAndPersistHeaderWidgetWithDetails()

        mockMvc.perform(
            get("/api/v1/case/{documentId}/header-widget", docId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.type").value(widgetType))
            .andExpect(jsonPath("$.highContrast").value(highContrast))
            .andExpect(jsonPath("$.properties.title").value("My Header"))
            .andExpect(jsonPath("$.properties.badge").value("42"))
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should get header widget data`() {
        val docId = createDocumentAndPersistHeaderWidget()

        whenever(
            caseWidgetService.getCaseHeaderWidgetData(
                any(), any(), any(), any()
            )
        ).thenReturn(mapOf("test" to "header123"))

        mockMvc.perform(
            get("/api/v1/case/{documentId}/header-widget/data", docId)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.test").value("header123"))
    }

    private fun createDocumentOnly(): String {
        val caseDefinitionName = "some-case-type"
        return runWithoutAuthorization {
            val payload: ObjectNode = mapper.createObjectNode()
            val document = documentService.createDocument(
                NewDocumentRequest(
                    caseDefinitionName,
                    caseDefinitionName,
                    "1.2.3",
                    payload
                )
            ).resultingDocument().get()
            document.id.toString()
        }
    }

    private fun createDocumentAndPersistHeaderWidget(): String {
        val caseDefinitionName = "some-case-type"
        return runWithoutAuthorization {
            val payload: ObjectNode = mapper.createObjectNode()
            val document = documentService.createDocument(
                NewDocumentRequest(
                    caseDefinitionName,
                    caseDefinitionName,
                    "1.2.3",
                    payload
                )
            ).resultingDocument().get()

            val caseDefinitionId = document.definitionId().caseDefinitionId()
            val id = CaseHeaderWidgetId(caseDefinitionId.key, caseDefinitionId.versionTag.toString())

            val props: Map<String, Any?> = mapOf("title" to "My Header", "badge" to "42")

            caseHeaderWidgetRepository.save(
                CaseHeaderWidget(
                    id = id,
                    type = "test-header",
                    highContrast = true,
                    properties = props
                )
            )
            document.id.toString()
        }
    }

    private fun createDocumentAndPersistHeaderWidgetWithDetails(): Triple<String, String, Boolean> {
        val caseDefinitionName = "some-case-type"
        return runWithoutAuthorization {
            val payload: ObjectNode = mapper.createObjectNode()
            val document = documentService.createDocument(
                NewDocumentRequest(
                    caseDefinitionName,
                    caseDefinitionName,
                    "1.2.3",
                    payload
                )
            ).resultingDocument().get()

            val caseDefinitionId = document.definitionId().caseDefinitionId()
            val id = CaseHeaderWidgetId(caseDefinitionId.key, caseDefinitionId.versionTag.toString())
            val widgetType = "test-header"
            val highContrast = true
            val props: Map<String, Any?> = mapOf("title" to "My Header", "badge" to "42")

            caseHeaderWidgetRepository.save(
                CaseHeaderWidget(
                    id = id,
                    type = widgetType,
                    highContrast = highContrast,
                    properties = props
                )
            )
            Triple(document.id.toString(), widgetType, highContrast)
        }
    }

    internal class MockConfig {
        @Bean
        fun caseWidgetService(): CaseWidgetService = Mockito.mock(CaseWidgetService::class.java)
    }
}