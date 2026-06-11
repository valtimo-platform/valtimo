/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import com.ritense.processlink.domain.ActivityTypeWithEventName
import com.ritense.processlink.domain.TestProcessLink
import com.ritense.processlink.domain.TestProcessLinkCreateRequestDto
import com.ritense.processlink.domain.TestProcessLinkMapper
import com.ritense.processlink.domain.TestProcessLinkUpdateRequestDto
import com.ritense.processlink.mapper.ProcessLinkMapper
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.validation.ProcessDefinitionValidator
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.service.OperatonProcessService
import com.ritense.valtimo.service.ProcessPropertyService
import org.operaton.bpm.engine.RepositoryService
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.http.HttpMethod
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.nio.charset.StandardCharsets
import java.util.UUID

internal class ProcessLinkResourceTest {

    lateinit var mockMvc: MockMvc
    lateinit var processLinkService: ProcessLinkService
    lateinit var processLinkMappers: List<ProcessLinkMapper>
    lateinit var processLinkResource: ProcessLinkResource
    lateinit var objectMapper: ObjectMapper
    lateinit var camdunaProcessService: OperatonProcessService
    lateinit var processDefinitionCaseDefinitionService: ProcessDefinitionCaseDefinitionService
    lateinit var repositoryService: RepositoryService
    lateinit var processDeploymentService: ProcessDeploymentService
    lateinit var processDefinitionValidator: ProcessDefinitionValidator
    lateinit var processPropertyService: ProcessPropertyService

    @BeforeEach
    fun init() {
        objectMapper = MapperSingleton.get()
        processLinkService = mock()
        camdunaProcessService = mock()
        processDefinitionCaseDefinitionService = mock()
        repositoryService = mock()
        processDeploymentService = mock()
        processDefinitionValidator = mock()
        processPropertyService = mock()
        processLinkMappers = listOf(TestProcessLinkMapper(objectMapper))
        processLinkResource = ProcessLinkResource(
            processLinkService,
            processLinkMappers,
            camdunaProcessService,
            processDefinitionCaseDefinitionService,
            repositoryService,
            processDeploymentService,
            processDefinitionValidator,
            processPropertyService
        )

        val mappingJackson2HttpMessageConverter = MappingJackson2HttpMessageConverter()
        mappingJackson2HttpMessageConverter.objectMapper = objectMapper

        mockMvc = MockMvcBuilders
            .standaloneSetup(processLinkResource)
            .setMessageConverters(mappingJackson2HttpMessageConverter)
            .build()
    }

    @Test
    fun `should list process links`() {
        val id1 = UUID.randomUUID()
        val id2 = UUID.randomUUID()
        val processDefinitionId = "pid"
        val activityId = "aid"
        val activityType = ActivityTypeWithEventName.SERVICE_TASK_START

        val processLinks = listOf(
            TestProcessLink(
                id = id1,
                processDefinitionId = processDefinitionId,
                activityId = activityId,
                activityType = activityType
            ),
            TestProcessLink(
                id = id2,
                processDefinitionId = processDefinitionId,
                activityId = activityId,
                activityType = activityType
            )
        )

        whenever(processLinkService.getProcessLinks(any(), any())).thenReturn(processLinks)

        mockMvc.perform(
            get("/api/v1/process-link?processDefinitionId=$processDefinitionId&activityId=$activityId")
                .characterEncoding(StandardCharsets.UTF_8.name())
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.[0].id").value(id1.toString()))
            .andExpect(jsonPath("$.[0].processDefinitionId").value(processDefinitionId))
            .andExpect(jsonPath("$.[0].activityId").value(activityId))
            .andExpect(jsonPath("$.[0].activityType").value(activityType.value))
            .andExpect(jsonPath("$.[1].id").value(id2.toString()))
            .andExpect(jsonPath("$.[1].processDefinitionId").value(processDefinitionId))
            .andExpect(jsonPath("$.[1].activityId").value(activityId))
            .andExpect(jsonPath("$.[1].activityType").value(activityType.value))


        verify(processLinkService).getProcessLinks(processDefinitionId, activityId)
    }

    @Test
    fun `should add process link`() {
        val processLinkDto = TestProcessLinkCreateRequestDto(
            processDefinitionId = UUID.randomUUID().toString(),
            activityId = "someActivity",
            activityType = ActivityTypeWithEventName.SERVICE_TASK_START
        )

        mockMvc.perform(
            post("/api/v1/process-link")
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(MapperSingleton.get().writeValueAsString(processLinkDto))
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        verify(processLinkService).createProcessLink(
            processLinkDto,
            null
        )
    }

    @Test
    fun `should update process link`() {
        val processLinkDto = TestProcessLinkUpdateRequestDto(
            id = UUID.randomUUID(),
        )

        mockMvc.perform(
            put("/api/v1/process-link")
                .characterEncoding(StandardCharsets.UTF_8.name())
                .contentType(MediaType.APPLICATION_JSON_VALUE)
                .content(MapperSingleton.get().writeValueAsString(processLinkDto))
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        verify(processLinkService).updateProcessLink(
            processLinkDto,
            null
        )
    }

    @Test
    fun `should delete process link`() {
        val processLinkId = UUID.randomUUID()

        mockMvc.perform(delete("/api/v1/process-link/{processLinkId}", processLinkId))
            .andDo(print())
            .andExpect(status().isNoContent)

        verify(processLinkService).deleteProcessLink(processLinkId)
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

    @Test
    fun `should return 409 when creating unlinked process definition that already exists`() {
        val existing = operatonProcessDefinition(id = "proc-def-id-2", key = "unlinked-process-key", name = null)
        whenever(processDeploymentService.findExistingUnlinkedProcessDefinition(anyOrNull(), anyOrNull()))
            .thenReturn(existing)

        mockMvc.perform(
            multipart("/api/management/v1/process-definition")
                .file(MockMultipartFile("processLinks", "processLinks.json", MediaType.APPLICATION_JSON_VALUE, "[]".toByteArray()))
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.processDefinitionKey").value("unlinked-process-key"))
            .andExpect(jsonPath("$.processDefinitionId").value("proc-def-id-2"))
    }

    @Test
    fun `should return 204 when creating unlinked process definition with no conflict`() {
        whenever(processDeploymentService.findExistingUnlinkedProcessDefinition(anyOrNull(), anyOrNull()))
            .thenReturn(null)

        mockMvc.perform(
            multipart("/api/management/v1/process-definition")
                .file(MockMultipartFile("processLinks", "processLinks.json", MediaType.APPLICATION_JSON_VALUE, "[]".toByteArray()))
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)
    }

    @Test
    fun `should deploy unlinked process definition on PUT without conflict check`() {
        mockMvc.perform(
            multipart(HttpMethod.PUT, "/api/management/v1/process-definition")
                .file(MockMultipartFile("processLinks", "processLinks.json", MediaType.APPLICATION_JSON_VALUE, "[]".toByteArray()))
                .contentType(MediaType.MULTIPART_FORM_DATA_VALUE)
                .accept(MediaType.APPLICATION_JSON_VALUE)
        )
            .andDo(print())
            .andExpect(status().isNoContent)

        verify(processDeploymentService).deployProcessDefinitionAndProcessLinks(anyOrNull(), anyOrNull(), any(), anyOrNull())
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
