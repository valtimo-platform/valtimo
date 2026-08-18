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

package com.ritense.processlink.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.processdocument.service.ProcessDefinitionCaseDefinitionService
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.service.OperatonProcessService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * Tests the case-definition process-definition management surface served by
 * [CaseProcessDefinitionManagementResource].
 */
internal class CaseProcessDefinitionManagementResourceTest {

    lateinit var mockMvc: MockMvc
    lateinit var operatonProcessService: OperatonProcessService
    lateinit var processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService
    lateinit var processLinkService: ProcessLinkService
    lateinit var repositoryService: RepositoryService
    lateinit var processDeploymentService: ProcessDeploymentService
    lateinit var objectMapper: ObjectMapper

    @BeforeEach
    fun init() {
        objectMapper = MapperSingleton.get()
        operatonProcessService = mock()
        processDefinitionCaseDefinitionService = mock()
        processLinkService = mock()
        repositoryService = mock()
        processDeploymentService = mock()

        val assembler = ProcessDefinitionResponseAssembler(processLinkService, repositoryService)
        val resource = CaseProcessDefinitionManagementResource(
            operatonProcessService,
            processDefinitionCaseDefinitionService,
            processLinkService,
            processDeploymentService,
            assembler,
        )

        val mappingJackson2HttpMessageConverter = MappingJackson2HttpMessageConverter()
        mappingJackson2HttpMessageConverter.objectMapper = objectMapper

        mockMvc = MockMvcBuilders
            .standaloneSetup(resource)
            .setMessageConverters(mappingJackson2HttpMessageConverter)
            .build()
    }

    @Test
    fun `should return 409 when creating case-linked process definition that already exists`() {
        val existing = operatonProcessDefinition(id = "proc-def-id-1", key = "test-process-key", name = "Test Process")
        whenever(processDeploymentService.findExistingProcessDefinitionForCaseDefinition(any(), anyOrNull(), anyOrNull()))
            .thenReturn(existing)

        mockMvc.perform(
            multipart("/api/management/v1/case-definition/{key}/version/{tag}/process-definition", "my-case", "1.0.0")
                .file(MockMultipartFile("processLinks", "processLinks.json", MediaType.APPLICATION_JSON_VALUE, "[]".toByteArray()))
                .param("canInitializeDocument", "false")
                .param("startableByUser", "false")
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.processDefinitionKey").value("test-process-key"))
            .andExpect(jsonPath("$.processDefinitionId").value("proc-def-id-1"))
            .andExpect(jsonPath("$.processDefinitionName").value("Test Process"))
    }

    @Test
    fun `should return 204 when creating case-linked process definition with no conflict`() {
        whenever(processDeploymentService.findExistingProcessDefinitionForCaseDefinition(any(), anyOrNull(), anyOrNull()))
            .thenReturn(null)

        mockMvc.perform(
            multipart("/api/management/v1/case-definition/{key}/version/{tag}/process-definition", "my-case", "1.0.0")
                .file(MockMultipartFile("processLinks", "processLinks.json", MediaType.APPLICATION_JSON_VALUE, "[]".toByteArray()))
                .param("canInitializeDocument", "false")
                .param("startableByUser", "false")
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)
    }

    @Test
    fun `should deploy case-linked process definition on PUT without conflict check`() {
        mockMvc.perform(
            multipart(HttpMethod.PUT, "/api/management/v1/case-definition/{key}/version/{tag}/process-definition", "my-case", "1.0.0")
                .file(MockMultipartFile("processLinks", "processLinks.json", MediaType.APPLICATION_JSON_VALUE, "[]".toByteArray()))
                .param("canInitializeDocument", "false")
                .param("startableByUser", "false")
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        verify(processDeploymentService).deployProcessDefinitionAndProcessLinksForCaseDefinition(any(), anyOrNull(), any(), anyOrNull(), any(), any())
    }

    private fun operatonProcessDefinition(id: String, key: String, name: String?) = OperatonProcessDefinition(
        id = id,
        revision = 1,
        category = null,
        name = name,
        key = key,
        version = 1,
        deploymentId = null,
        resourceName = null,
        diagramResourceName = null,
        hasStartFormKey = null,
        suspensionState = null,
        tenantId = null,
        versionTag = null,
        historyTimeToLive = null,
        isStartableInTasklist = false
    )
}
