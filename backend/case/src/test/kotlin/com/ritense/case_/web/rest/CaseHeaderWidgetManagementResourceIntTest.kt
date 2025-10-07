package com.ritense.case_.web.rest

import com.ritense.BaseIntegrationTest
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.case_.rest.dto.CaseHeaderWidgetCreateDto
import com.ritense.case_.rest.dto.CaseHeaderWidgetUpdateDto
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.utils.TestUtil
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.WebApplicationContext

@Transactional
class CaseHeaderWidgetManagementResourceIntTest @Autowired constructor(
    private val webApplicationContext: WebApplicationContext
) : BaseIntegrationTest() {

    private lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should return no content when header widget not found`() {
        val key = "some-case-type"
        val version = "1.2.3"

        mockMvc.perform(
            get("/api/management/v1/case-definition/{key}/version/{version}/header-widget", key, version)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andExpect(status().isNoContent)
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should create case header widget`() {
        val key = "some-case-type"
        val version = "1.2.3"
        val create = CaseHeaderWidgetCreateDto(
            type = "fields",
            highContrast = true,
            properties = mapOf("title" to "Header", "badge" to 5)
        )

        mockMvc.perform(
            post("/api/management/v1/case-definition/{key}/version/{version}/header-widget", key, version)
                .content(TestUtil.convertObjectToJsonBytes(create))
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.caseDefinitionKey").value(key))
            .andExpect(jsonPath("$.caseDefinitionVersionTag").value(version))
            .andExpect(jsonPath("$.type").value("fields"))
            .andExpect(jsonPath("$.highContrast").value(true))
            .andExpect(jsonPath("$.properties.title").value("Header"))
            .andExpect(jsonPath("$.properties.badge").value(5))
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should get case header widget`() {
        val key = "some-case-type"
        val version = "1.2.3"
        runWithoutAuthorization {
            mockMvc.perform(
                post("/api/management/v1/case-definition/{key}/version/{version}/header-widget", key, version)
                    .content(
                        TestUtil.convertObjectToJsonBytes(
                            CaseHeaderWidgetCreateDto(
                                type = "fields",
                                highContrast = false,
                                properties = mapOf("title" to "Header")
                            )
                        )
                    )
                    .contentType(MediaType.APPLICATION_JSON_VALUE)
            ).andExpect(status().isOk)
        }

        mockMvc.perform(
            get("/api/management/v1/case-definition/{key}/version/{version}/header-widget", key, version)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.caseDefinitionKey").value(key))
            .andExpect(jsonPath("$.caseDefinitionVersionTag").value(version))
            .andExpect(jsonPath("$.type").value("fields"))
            .andExpect(jsonPath("$.properties.title").value("Header"))
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should update case header widget`() {
        val key = "some-case-type"
        val version = "1.2.3"
        runWithoutAuthorization {
            mockMvc.perform(
                post("/api/management/v1/case-definition/{key}/version/{version}/header-widget", key, version)
                    .content(
                        TestUtil.convertObjectToJsonBytes(
                            CaseHeaderWidgetCreateDto(
                                type = "fields",
                                highContrast = false,
                                properties = mapOf("title" to "Header")
                            )
                        )
                    )
                    .contentType(MediaType.APPLICATION_JSON_VALUE)
            ).andExpect(status().isOk)
        }

        val update = CaseHeaderWidgetUpdateDto(
            highContrast = true,
            properties = mapOf("title" to "Updated", "badge" to "42")
        )

        mockMvc.perform(
            put("/api/management/v1/case-definition/{key}/version/{version}/header-widget", key, version)
                .content(TestUtil.convertObjectToJsonBytes(update))
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.caseDefinitionKey").value(key))
            .andExpect(jsonPath("$.caseDefinitionVersionTag").value(version))
            .andExpect(jsonPath("$.type").value("fields"))
            .andExpect(jsonPath("$.highContrast").value(true))
            .andExpect(jsonPath("$.properties.title").value("Updated"))
            .andExpect(jsonPath("$.properties.badge").value("42"))
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should delete case header widget`() {
        val key = "some-case-type"
        val version = "1.2.3"
        runWithoutAuthorization {
            mockMvc.perform(
                post("/api/management/v1/case-definition/{key}/version/{version}/header-widget", key, version)
                    .content(
                        TestUtil.convertObjectToJsonBytes(
                            CaseHeaderWidgetCreateDto(
                                type = "fields",
                                highContrast = false,
                                properties = mapOf("title" to "Header")
                            )
                        )
                    )
                    .contentType(MediaType.APPLICATION_JSON_VALUE)
            ).andExpect(status().isOk)
        }

        mockMvc.perform(
            delete("/api/management/v1/case-definition/{key}/version/{version}/header-widget", key, version)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andDo(print())
            .andExpect(status().isNoContent)

        mockMvc.perform(
            get("/api/management/v1/case-definition/{key}/version/{version}/header-widget", key, version)
                .contentType(MediaType.APPLICATION_JSON_VALUE)
        ).andExpect(status().isNoContent)
    }
}