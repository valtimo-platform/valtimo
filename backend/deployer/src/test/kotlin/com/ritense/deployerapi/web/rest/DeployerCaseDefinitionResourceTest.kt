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

package com.ritense.deployerapi.web.rest

import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.case_.repository.CaseDefinitionRepository
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.CaseDefinitionExportRequest
import com.ritense.importer.ImportService
import com.ritense.importer.exception.ImportServiceException
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.json.MapperSingleton
import org.hamcrest.Matchers.startsWith
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.MediaType
import org.springframework.http.converter.ByteArrayHttpMessageConverter
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.io.ByteArrayOutputStream
import java.util.Base64
import kotlin.test.assertEquals

class DeployerCaseDefinitionResourceTest {

    lateinit var mockMvc: MockMvc
    lateinit var caseDefinitionService: CaseDefinitionService
    lateinit var exportService: ExportService
    lateinit var importService: ImportService
    lateinit var caseDefinitionRepository: CaseDefinitionRepository

    @BeforeEach
    fun setUp() {
        caseDefinitionService = mock()
        exportService = mock()
        importService = mock()
        caseDefinitionRepository = mock()

        val converter = MappingJackson2HttpMessageConverter()
        converter.objectMapper = MapperSingleton.get()

        mockMvc = MockMvcBuilders
            .standaloneSetup(
                DeployerCaseDefinitionResource(
                    caseDefinitionService,
                    exportService,
                    importService,
                    caseDefinitionRepository,
                )
            )
            .setMessageConverters(converter, ByteArrayHttpMessageConverter())
            .build()
    }

    @Test
    fun `should list case definitions`() {
        whenever(caseDefinitionService.getCaseDefinitions(isNull(), isNull(), isNull(), isNull()))
            .thenReturn(listOf(caseDefinition("my-case", "1.0.0")))

        mockMvc.perform(get("/api/deployer/v1/case-definition"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].caseDefinitionKey").value("my-case"))
            .andExpect(jsonPath("$[0].caseDefinitionVersionTag").value("1.0.0"))
    }

    @Test
    fun `should pass list filters on to the case definition service`() {
        whenever(caseDefinitionService.getCaseDefinitions(eq("my-case"), isNull(), eq(true), eq(false)))
            .thenReturn(emptyList())

        mockMvc.perform(
            get("/api/deployer/v1/case-definition")
                .param("caseDefinitionKey", "my-case")
                .param("active", "true")
                .param("final", "false")
        ).andExpect(status().isOk)

        verify(caseDefinitionService).getCaseDefinitions(eq("my-case"), isNull(), eq(true), eq(false))
    }

    @Test
    fun `should export a case definition as an attachment`() {
        val zip = ByteArrayOutputStream().apply { write(byteArrayOf(1, 2, 3)) }
        whenever(exportService.export(CaseDefinitionExportRequest(CaseDefinitionId("my-case", "1.0.0"))))
            .thenReturn(zip)

        mockMvc.perform(get("/api/deployer/v1/case-definition/my-case/version/1.0.0/export"))
            .andExpect(status().isOk)
            .andExpect(content().contentType(MediaType.APPLICATION_OCTET_STREAM))
            .andExpect(
                header().string("Content-Disposition", startsWith("attachment;filename=my-case_1.0.0_"))
            )
            .andExpect(content().bytes(byteArrayOf(1, 2, 3)))
    }

    @Test
    fun `should import a base64 encoded case definition`() {
        val importedId = CaseDefinitionId("my-case", "1.0.0")
        whenever(caseDefinitionRepository.findAllByFinalTrue()).thenReturn(emptyList())
        whenever(importService.import(any(), any(), isNull(), isNull())).thenReturn(importedId)

        mockMvc.perform(
            post("/api/deployer/v1/case-definition/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content(importBody(byteArrayOf(1, 2, 3)))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.caseDefinitionId.key").value("my-case"))

        verify(caseDefinitionService).setLatestToActiveIfNoneIsActive()
    }

    @Test
    fun `should import with key and name overrides`() {
        whenever(caseDefinitionRepository.findAllByFinalTrue()).thenReturn(emptyList())
        whenever(importService.import(any(), any(), eq("new-key"), eq("New Name")))
            .thenReturn(CaseDefinitionId("new-key", "1.0.0"))

        mockMvc.perform(
            post("/api/deployer/v1/case-definition/import")
                .param("key", "new-key")
                .param("name", "New Name")
                .contentType(MediaType.APPLICATION_JSON)
                .content(importBody(byteArrayOf(1, 2, 3)))
        ).andExpect(status().isOk)

        verify(importService).import(any(), any(), eq("new-key"), eq("New Name"))
    }

    @Test
    fun `should skip case definitions that are already final`() {
        val finalId = CaseDefinitionId("existing-case", "1.0.0")
        whenever(caseDefinitionRepository.findAllByFinalTrue())
            .thenReturn(listOf(caseDefinition("existing-case", "1.0.0", final = true)))
        whenever(importService.import(any(), any(), isNull(), isNull()))
            .thenReturn(CaseDefinitionId("my-case", "1.0.0"))

        mockMvc.perform(
            post("/api/deployer/v1/case-definition/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content(importBody(byteArrayOf(1, 2, 3)))
        ).andExpect(status().isOk)

        verify(importService).import(any(), eq(listOf(finalId)), isNull(), isNull())
    }

    @Test
    fun `should return bad request when the import fails`() {
        whenever(caseDefinitionRepository.findAllByFinalTrue()).thenReturn(emptyList())
        whenever(importService.import(any(), any(), isNull(), isNull()))
            .thenThrow(ImportServiceException("Invalid zip"))

        mockMvc.perform(
            post("/api/deployer/v1/case-definition/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content(importBody(byteArrayOf(1, 2, 3)))
        ).andExpect(status().isBadRequest)

        verify(caseDefinitionService, never()).setLatestToActiveIfNoneIsActive()
    }

    @Test
    fun `should redirect the openapi spec to the generated deployer group`() {
        val specMockMvc = MockMvcBuilders.standaloneSetup(DeployerOpenApiResource()).build()

        val response = specMockMvc.perform(get("/api/deployer/v1/openapi.json"))
            .andExpect(status().isFound)
            .andReturn().response

        assertEquals("/v3/api-docs/deployer", response.getHeader("Location"))
    }

    private fun importBody(file: ByteArray) =
        """{"file":"${Base64.getEncoder().encodeToString(file)}"}"""

    private fun caseDefinition(key: String, versionTag: String, final: Boolean = false) = CaseDefinition(
        id = CaseDefinitionId(key, versionTag),
        name = key,
        createdDate = null,
        final = final,
    )
}
