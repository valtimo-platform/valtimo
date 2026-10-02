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

package com.ritense.processdocument.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.document.domain.impl.request.NewDocumentRequest
import com.ritense.document.service.DocumentService
import com.ritense.processdocument.BaseIntegrationTest
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.USER
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.support.TransactionTemplate
import org.springframework.web.context.WebApplicationContext
import java.util.UUID

class CaseDocumentViewPermissionIntTest : BaseIntegrationTest() {

    @Autowired
    private lateinit var webApplicationContext: WebApplicationContext

    @Autowired
    private lateinit var documentService: DocumentService

    @Autowired
    private lateinit var objectMapper: ObjectMapper

    @Autowired
    private lateinit var transactionTemplate: TransactionTemplate

    private lateinit var mockMvc: MockMvc
    private lateinit var caseId: UUID

    @BeforeEach
    fun init() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()

        caseId = checkNotNull(transactionTemplate.execute {
            runWithoutAuthorization {
                documentService.createDocument(
                    NewDocumentRequest(
                        "house",
                        "house",
                        "1.0.0",
                        objectMapper.readTree("""{ "street": "main", "houseNumber": 1 }""")
                    )
                ).resultingDocument().orElseThrow().id().id
            }
        })
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should deny case process links without document view permission`() {
        mockMvc.perform(get("/api/v1/document-instance/{documentId}/case-process-link", caseId))
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER, CASE_VIEWER])
    fun `should return case process links with document view permission`() {
        mockMvc.perform(get("/api/v1/document-instance/{documentId}/case-process-link", caseId))
            .andExpect(status().isOk)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should deny process timers without document view permission`() {
        mockMvc.perform(
            get("/api/v1/process-document/case/{caseId}/process-instance/{processInstanceId}/timers", caseId, UUID.randomUUID())
        )
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should deny skipping a process timer without document view permission`() {
        mockMvc.perform(
            post(
                "/api/v1/process-document/case/{caseId}/process-instance/{processInstanceId}/timer/{jobId}/skip",
                caseId,
                UUID.randomUUID(),
                "job-1"
            )
        )
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER, CASE_VIEWER])
    fun `should pass the document gate for process timers with document view permission`() {
        mockMvc.perform(
            get("/api/v1/process-document/case/{caseId}/process-instance/{processInstanceId}/timers", caseId, UUID.randomUUID())
        )
            .andExpect(status().isNotFound)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER])
    fun `should deny the process diagram without document view permission`() {
        mockMvc.perform(
            get("/api/v1/process-document/case/{caseId}/process-instance/{processInstanceId}/xml", caseId, UUID.randomUUID())
        )
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER, CASE_VIEWER])
    fun `should pass the document gate for the process diagram with document view permission`() {
        mockMvc.perform(
            get("/api/v1/process-document/case/{caseId}/process-instance/{processInstanceId}/xml", caseId, UUID.randomUUID())
        )
            .andExpect(status().isNotFound)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER, CASE_VIEWER])
    fun `should deny the inspection process diagram without document inspect permission`() {
        mockMvc.perform(
            get("/api/management/v1/case/{caseId}/process-instance/{processInstanceId}/xml", caseId, UUID.randomUUID())
        )
            .andExpect(status().isForbidden)
    }

    @Test
    @WithMockUser(username = "user@ritense.com", authorities = [USER, ADMIN])
    fun `should pass the document gate for the inspection process diagram with document inspect permission`() {
        mockMvc.perform(
            get("/api/management/v1/case/{caseId}/process-instance/{processInstanceId}/xml", caseId, UUID.randomUUID())
        )
            .andExpect(status().isNotFound)
    }

    companion object {
        private const val CASE_VIEWER = "ROLE_CASE_VIEWER"
    }
}
