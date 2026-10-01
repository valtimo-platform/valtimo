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

import com.ritense.case.exception.UnknownCaseDefinitionException
import com.ritense.case.service.CaseDefinitionImportService
import com.ritense.case.service.CaseDefinitionService
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.exporter.ExportService
import com.ritense.exporter.request.CaseDefinitionExportRequest
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
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.converter.ByteArrayHttpMessageConverter
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.security.access.AccessDeniedException
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.server.ResponseStatusException
import org.zalando.problem.Problem
import org.zalando.problem.Status
import java.io.ByteArrayOutputStream
import java.util.Base64
import java.util.UUID
import kotlin.test.assertEquals

class DeployerCaseDefinitionResourceTest {

    lateinit var mockMvc: MockMvc
    lateinit var caseDefinitionService: CaseDefinitionService
    lateinit var exportService: ExportService
    lateinit var caseDefinitionImportService: CaseDefinitionImportService

    @BeforeEach
    fun setUp() {
        caseDefinitionService = mock()
        exportService = mock()
        caseDefinitionImportService = mock()

        val converter = MappingJackson2HttpMessageConverter()
        converter.objectMapper = MapperSingleton.get()

        mockMvc = MockMvcBuilders
            .standaloneSetup(
                DeployerCaseDefinitionResource(
                    caseDefinitionService,
                    exportService,
                    caseDefinitionImportService,
                )
            )
            .setControllerAdvice(DeployerApiExceptionHandler())
            .setMessageConverters(converter, ByteArrayHttpMessageConverter())
            .build()
    }

    @Test
    fun `should list only active case definitions by default`() {
        whenever(caseDefinitionService.getCaseDefinitions(isNull(), isNull(), eq(true), isNull()))
            .thenReturn(listOf(caseDefinition("my-case", "1.0.0")))

        mockMvc.perform(get("/api/deployer/v1/case-definition"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].caseDefinitionKey").value("my-case"))
            .andExpect(jsonPath("$[0].caseDefinitionVersionTag").value("1.0.0"))

        verify(caseDefinitionService).getCaseDefinitions(isNull(), isNull(), eq(true), isNull())
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
    fun `should return not found with an error body when the case definition does not exist`() {
        whenever(exportService.export(CaseDefinitionExportRequest(CaseDefinitionId("my-case", "1.0.0"))))
            .thenThrow(UnknownCaseDefinitionException(CaseDefinitionId("my-case", "1.0.0")))

        mockMvc.perform(get("/api/deployer/v1/case-definition/my-case/version/1.0.0/export"))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.message").value(startsWith("Case definition with id my-case:1.0.0")))
    }

    @Test
    fun `should return bad request with an error body for an invalid version tag`() {
        mockMvc.perform(get("/api/deployer/v1/case-definition/my-case/version/not-a-semver/export"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value(startsWith("Given version 'not-a-semver'")))
    }

    @Test
    fun `should return an error body instead of problem json for an unexpected failure`() {
        whenever(caseDefinitionService.getCaseDefinitions(isNull(), isNull(), eq(true), isNull()))
            .thenThrow(IllegalStateException("connection reset"))

        mockMvc.perform(get("/api/deployer/v1/case-definition"))
            .andExpect(status().isInternalServerError)
            .andExpect(jsonPath("$.message").value("Internal server error"))
    }

    @Test
    fun `should return bad request with an error body when the request cannot be read`() {
        mockMvc.perform(
            post("/api/deployer/v1/case-definition/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content("not json")
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value("Request could not be read"))
    }

    @Test
    fun `should return bad request instead of server error for an unparsable query parameter`() {
        mockMvc.perform(get("/api/deployer/v1/case-definition").param("active", "not-a-boolean"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").isNotEmpty)

        verify(caseDefinitionService, never()).getCaseDefinitions(any(), any(), any(), any())
    }

    @Test
    fun `should return forbidden instead of server error when access is denied`() {
        whenever(caseDefinitionService.getCaseDefinitions(isNull(), isNull(), eq(true), isNull()))
            .thenThrow(AccessDeniedException("denied"))

        mockMvc.perform(get("/api/deployer/v1/case-definition"))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.message").value("Access denied"))
    }

    @Test
    fun `should keep the status of an exception that carries one`() {
        whenever(caseDefinitionService.getCaseDefinitions(isNull(), isNull(), eq(true), isNull()))
            .thenThrow(ResponseStatusException(HttpStatus.CONFLICT))

        mockMvc.perform(get("/api/deployer/v1/case-definition"))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.message").value("Conflict"))
    }

    @Test
    fun `should keep the status and detail of a problem`() {
        whenever(caseDefinitionService.getCaseDefinitions(isNull(), isNull(), eq(true), isNull()))
            .thenThrow(Problem.valueOf(Status.BAD_REQUEST, "Column 'foo' is not valid"))

        mockMvc.perform(get("/api/deployer/v1/case-definition"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value("Column 'foo' is not valid"))
    }

    @Test
    fun `should not echo the detail of a problem that carries a server error status`() {
        whenever(caseDefinitionService.getCaseDefinitions(isNull(), isNull(), eq(true), isNull()))
            .thenThrow(Problem.valueOf(Status.INTERNAL_SERVER_ERROR, "jdbc url jdbc:postgresql://db/gzac"))

        mockMvc.perform(get("/api/deployer/v1/case-definition"))
            .andExpect(status().isInternalServerError)
            .andExpect(jsonPath("$.message").value("Internal server error"))
    }

    @Test
    fun `should import a base64 encoded case definition`() {
        val importedId = CaseDefinitionId("my-case", "1.0.0")
        whenever(caseDefinitionImportService.import(any(), isNull(), isNull(), isNull())).thenReturn(importedId)

        mockMvc.perform(
            post("/api/deployer/v1/case-definition/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content(importBody(byteArrayOf(1, 2, 3)))
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.caseDefinitionId.key").value("my-case"))

        verify(caseDefinitionImportService).import(any(), isNull(), isNull(), isNull())
    }

    @Test
    fun `should import with key and name overrides`() {
        whenever(caseDefinitionImportService.import(any(), eq("new-key"), eq("New Name"), isNull()))
            .thenReturn(CaseDefinitionId("new-key", "1.0.0"))

        mockMvc.perform(
            post("/api/deployer/v1/case-definition/import")
                .param("key", "new-key")
                .param("name", "New Name")
                .contentType(MediaType.APPLICATION_JSON)
                .content(importBody(byteArrayOf(1, 2, 3)))
        ).andExpect(status().isOk)

        verify(caseDefinitionImportService).import(any(), eq("new-key"), eq("New Name"), isNull())
    }

    @Test
    fun `should forward plugin configuration mappings to the import service`() {
        val source = UUID.randomUUID()
        val target = UUID.randomUUID()
        whenever(caseDefinitionImportService.import(any(), isNull(), isNull(), any()))
            .thenReturn(CaseDefinitionId("my-case", "1.0.0"))

        mockMvc.perform(
            post("/api/deployer/v1/case-definition/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """{"file":"${Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3))}",""" +
                        """"pluginConfigurationMappings":{"$source":"$target"}}"""
                )
        ).andExpect(status().isOk)

        verify(caseDefinitionImportService).import(any(), isNull(), isNull(), eq(mapOf(source to target)))
    }

    @Test
    fun `should return bad request when the import fails`() {
        whenever(caseDefinitionImportService.import(any(), isNull(), isNull(), isNull()))
            .thenThrow(ImportServiceException("Invalid zip"))

        mockMvc.perform(
            post("/api/deployer/v1/case-definition/import")
                .contentType(MediaType.APPLICATION_JSON)
                .content(importBody(byteArrayOf(1, 2, 3)))
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.message").value("Invalid zip"))
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

    private fun caseDefinition(key: String, versionTag: String) = CaseDefinition(
        id = CaseDefinitionId(key, versionTag),
        name = key,
        createdDate = null,
    )
}
