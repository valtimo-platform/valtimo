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
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.GlobalProcessDefinitionExportRequest
import com.ritense.importer.ImportService
import com.ritense.importer.exception.ImportServiceException
import com.ritense.processlink.service.ProcessDefinitionImportPreviewService
import com.ritense.processlink.service.ProcessDeploymentService
import com.ritense.processlink.service.ProcessLinkService
import com.ritense.processlink.validation.ProcessDefinitionValidator
import com.ritense.processlink.web.rest.dto.MissingReferenceDto
import com.ritense.processlink.web.rest.dto.MissingReferenceType
import com.ritense.processlink.web.rest.dto.ProcessDefinitionImportPreviewResponseDto
import com.ritense.valtimo.contract.json.MapperSingleton
import com.ritense.valtimo.operaton.domain.OperatonProcessDefinition
import com.ritense.valtimo.processautofill.service.ProcessDefinitionAutofillService
import com.ritense.valtimo.service.OperatonProcessService
import com.ritense.valtimo.service.ProcessPropertyService
import org.hamcrest.Matchers.matchesRegex
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.operaton.bpm.engine.RepositoryService
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.converter.ByteArrayHttpMessageConverter
import org.springframework.http.converter.StringHttpMessageConverter
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.result.MockMvcResultHandlers.print
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.io.ByteArrayOutputStream

/**
 * Tests the case-unlinked ("system") process-definition management surface served by
 * [ProcessDefinitionManagementResource], including its export and import endpoints.
 */
internal class ProcessDefinitionManagementResourceTest {

    lateinit var mockMvc: MockMvc
    lateinit var operatonProcessService: OperatonProcessService
    lateinit var processPropertyService: ProcessPropertyService
    lateinit var processLinkService: ProcessLinkService
    lateinit var repositoryService: RepositoryService
    lateinit var processDeploymentService: ProcessDeploymentService
    lateinit var processDefinitionValidator: ProcessDefinitionValidator
    lateinit var exportService: ExportService
    lateinit var importService: ImportService
    lateinit var processDefinitionImportPreviewService: ProcessDefinitionImportPreviewService
    lateinit var processDefinitionAutofillService: ProcessDefinitionAutofillService
    lateinit var objectMapper: ObjectMapper

    @BeforeEach
    fun init() {
        objectMapper = MapperSingleton.get()
        operatonProcessService = mock()
        processPropertyService = mock()
        processLinkService = mock()
        repositoryService = mock()
        processDeploymentService = mock()
        processDefinitionValidator = mock()
        exportService = mock()
        importService = mock()
        processDefinitionImportPreviewService = mock()
        processDefinitionAutofillService = mock()

        val assembler = ProcessDefinitionResponseAssembler(
            processLinkService,
            repositoryService,
            processDefinitionAutofillService,
        )
        val resource = ProcessDefinitionManagementResource(
            operatonProcessService,
            processPropertyService,
            processLinkService,
            processDeploymentService,
            processDefinitionValidator,
            processDefinitionAutofillService,
            exportService,
            importService,
            processDefinitionImportPreviewService,
            objectMapper,
            assembler,
        )

        val mappingJackson2HttpMessageConverter = MappingJackson2HttpMessageConverter()
        mappingJackson2HttpMessageConverter.objectMapper = objectMapper

        mockMvc = MockMvcBuilders
            .standaloneSetup(resource)
            // The export endpoint responds with a zip, which needs the byte array converter
            .setMessageConverters(
                mappingJackson2HttpMessageConverter,
                ByteArrayHttpMessageConverter(),
                // Multipart parts that are bound to a String, such as pluginConfigurationMappings
                StringHttpMessageConverter(),
            )
            .build()
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

        verify(processDeploymentService).deployProcessDefinitionAndProcessLinks(anyOrNull(), anyOrNull(), any(), anyOrNull(), any())
    }

    @Test
    fun `should export a process definition as a zip`() {
        whenever(operatonProcessService.getProcessDefinitionById("pid"))
            .thenReturn(operatonProcessDefinition("pid", "my-process", "My process"))
        whenever(exportService.export(GlobalProcessDefinitionExportRequest("pid")))
            .thenReturn(ByteArrayOutputStream().apply { write("zip-content".toByteArray()) })

        mockMvc.perform(get("/api/management/v1/process-definition/pid/export"))
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(
                header().string(
                    "Content-Disposition",
                    matchesRegex("attachment;filename=my-process_v1_.*\\.process\\.zip")
                )
            )
    }

    @Test
    fun `should preview a process definition import`() {
        whenever(processDefinitionImportPreviewService.preview(any()))
            .thenReturn(ProcessDefinitionImportPreviewResponseDto(processDefinitionKeys = listOf("my-process")))

        mockMvc.perform(
            multipart("/api/management/v1/process-definition/import/preview")
                .file(MockMultipartFile("file", "my-process.process.zip", null, "zip".toByteArray()))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.processDefinitionKeys.[0]").value("my-process"))
            .andExpect(jsonPath("$.canImport").value(true))
    }

    @Test
    fun `should return a bad request when the import preview fails`() {
        whenever(processDefinitionImportPreviewService.preview(any()))
            .thenThrow(ImportServiceException("Archive was empty or not a zip"))

        mockMvc.perform(
            multipart("/api/management/v1/process-definition/import/preview")
                .file(MockMultipartFile("file", "invalid.zip", null, "invalid".toByteArray()))
        )
            .andDo(print())
            .andExpect(status().isBadRequest)
    }

    @Test
    fun `should import a process definition`() {
        whenever(processDefinitionImportPreviewService.preview(any()))
            .thenReturn(ProcessDefinitionImportPreviewResponseDto(processDefinitionKeys = listOf("my-process")))

        mockMvc.perform(
            multipart("/api/management/v1/process-definition/import")
                .file(MockMultipartFile("file", "my-process.process.zip", null, "zip".toByteArray()))
        )
            .andDo(print())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.processDefinitionKeys.[0]").value("my-process"))

        verify(importService).importGlobal(any(), anyOrNull())
    }

    @Test
    fun `should return a bad request when the plugin configuration mappings cannot be read`() {
        whenever(processDefinitionImportPreviewService.preview(any()))
            .thenReturn(ProcessDefinitionImportPreviewResponseDto(processDefinitionKeys = listOf("my-process")))

        mockMvc.perform(
            multipart("/api/management/v1/process-definition/import")
                .file(MockMultipartFile("file", "my-process.process.zip", null, "zip".toByteArray()))
                .file(
                    MockMultipartFile(
                        "pluginConfigurationMappings",
                        "mappings.json",
                        MediaType.TEXT_PLAIN_VALUE,
                        "not json".toByteArray()
                    )
                )
        )
            .andDo(print())
            .andExpect(status().isBadRequest)

        // The method was entered, so the bad request comes from the unreadable mappings
        verify(processDefinitionImportPreviewService).preview(any())
        verify(importService, never()).importGlobal(any(), anyOrNull())
    }

    @Test
    fun `should refuse to import when a reference blocks the import`() {
        val missingReference = MissingReferenceDto(
            type = MissingReferenceType.READ_ONLY_SYSTEM_PROCESS,
            reference = "my-process",
        )
        whenever(processDefinitionImportPreviewService.preview(any())).thenReturn(
            ProcessDefinitionImportPreviewResponseDto(
                processDefinitionKeys = listOf("my-process"),
                missingReferences = listOf(missingReference),
            )
        )

        mockMvc.perform(
            multipart("/api/management/v1/process-definition/import")
                .file(MockMultipartFile("file", "my-process.process.zip", null, "zip".toByteArray()))
        )
            .andDo(print())
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.missingReferences.[0].type").value("READ_ONLY_SYSTEM_PROCESS"))
            .andExpect(jsonPath("$.missingReferences.[0].reference").value("my-process"))

        verify(importService, never()).importGlobal(any(), anyOrNull())
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
