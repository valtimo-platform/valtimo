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

package com.ritense.processdocument.golden

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.processdocument.domain.impl.request.NewDocumentAndStartProcessRequest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import com.ritense.valtimo.test.golden.GoldenMvc
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.operaton.bpm.engine.RuntimeService
import org.operaton.bpm.engine.TaskService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType.APPLICATION_JSON
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext

class ConsumerApiGoldenIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    lateinit var objectMapper: ObjectMapper

    @Autowired
    lateinit var runtimeService: RuntimeService

    @Autowired
    lateinit var taskService: TaskService

    lateinit var mockMvc: MockMvc

    @BeforeEach
    fun setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()
        val processInstanceIds = runtimeService.createProcessInstanceQuery().list().map { it.id }
        runtimeService.deleteProcessInstances(processInstanceIds, "Golden test isolation", true, false)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER, ADMIN, "ROLE_CASE_VIEWER", "ROLE_HOUSE_OWNER"])
    fun `documents, cases, tasks and processes keep their JSON`() {
        val content = """{"first-name": "Golda", "last-name": "Goldenhuis", "street": "Keizersgracht", "number": 12, "city": "Amsterdam"}"""
        val result = runWithoutAuthorization {
            operatonProcessJsonSchemaDocumentService.newDocumentAndStartProcess(
                NewDocumentAndStartProcessRequest(
                    "single-user-task-process",
                    NewDocumentRequest("house", "house", "1.0.0", objectMapper.readTree(content))
                ).withProcessVars(mapOf("context" to "Amsterdam", "approved" to true, "amount" to 12.5))
            )
        }
        val documentId = result.resultingDocument().orElseThrow().id().id
        val processInstanceId = result.resultingProcessInstanceId().orElseThrow().toString()
        val taskId = checkNotNull(taskService.createTaskQuery().processInstanceId(processInstanceId).singleResult()).id

        golden("document", get("/api/v1/document/{id}", documentId), listOf("/body/sequence"))
        golden(
            "case-search",
            post("/api/v1/case/house/search").param("size", "1").param("sort", "createdOn,DESC")
                .contentType(APPLICATION_JSON).content("{}"),
            listOf("/body/totalElements", "/body/totalPages", "/body/last")
        )
        golden("task-list-v2", get("/api/v2/task").param("filter", "all"))
        golden("task", get("/api/v1/task/{id}", taskId))
        golden(
            "task-list-v3-case",
            post("/api/v3/task").param("filter", "ALL").contentType(APPLICATION_JSON)
                .content("""{"caseDefinitionKey": "house"}""")
        )
        golden(
            "task-list-v3",
            post("/api/v3/task").param("filter", "ALL").contentType(APPLICATION_JSON).content("{}")
        )
        golden("process", get("/api/v1/process/{id}", processInstanceId))
        golden("process-history", get("/api/v1/process/{id}/history", processInstanceId))
        golden("process-tasks", get("/api/v1/process/{id}/tasks", processInstanceId))
        golden(
            "process-search-v2",
            post("/api/v2/process/single-user-task-process/search").contentType(APPLICATION_JSON).content("{}"),
            unorderedPaths = listOf("/body/content/*/variables")
        )
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER, ADMIN, "ROLE_CASE_VIEWER", "ROLE_HOUSE_OWNER"])
    fun `error responses keep their JSON`() {
        golden("error-document-not-found", get("/api/v1/document/{id}", "00000000-0000-0000-0000-000000000001"))
        golden(
            "error-unreadable-body",
            post("/api/v1/case/house/search").contentType(APPLICATION_JSON).content("""{"globalSearchFilter": """)
        )
        golden(
            "error-validation",
            post("/api/v3/task").param("filter", "ALL").contentType(APPLICATION_JSON)
                .content("""{"caseDefinitionKey": "${"x".repeat(300)}"}""")
        )
        golden("error-missing-parameter", post("/api/v3/task").contentType(APPLICATION_JSON).content("{}"))
        golden("error-invalid-enum", get("/api/v2/task").param("filter", "everything"))
    }

    private fun golden(
        name: String,
        request: MockHttpServletRequestBuilder,
        ignorePaths: List<String> = emptyList(),
        unorderedPaths: List<String> = emptyList(),
    ) {
        val result = mockMvc.perform(request.with { it.apply { remoteAddr = "10.20.30.40" } }).andReturn()
        GoldenMvc.assertMatchesGolden(javaClass, name, result, ignorePaths + "/body/*/durationInMillis", unorderedPaths)
    }
}
