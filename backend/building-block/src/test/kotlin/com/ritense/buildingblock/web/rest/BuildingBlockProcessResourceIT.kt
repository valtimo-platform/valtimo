/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.buildingblock.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.service.BuildingBlockProcessService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockProcessDefinitionWithLinksDto
import com.ritense.processlink.web.rest.dto.ProcessLinkCreateRequestDto
import com.ritense.valtimo.web.rest.dto.ProcessDefinitionWithPropertiesDto
import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.mock.web.MockPart
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.multipart
import java.nio.charset.StandardCharsets

class BuildingBlockProcessResourceIT @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper
) : BaseIntegrationTest() {

    @MockitoBean
    lateinit var buildingBlockProcessService: BuildingBlockProcessService

    private val base = "/api/management/v1/building-block"
    private val key = "bb-key"
    private val version = "1.0.0"
    private val processDefinitionId = "proc-def-1"

    @Test
    @WithMockUser
    @DisplayName("should return 200 with empty list when no process definitions found")
    fun shouldReturn200WithEmptyListWhenNoProcessDefinitionsFound() {
        whenever(buildingBlockProcessService.getProcessDefinitionsForBuildingBlock(eq(key), eq(version)))
            .thenReturn(emptyList())

        mockMvc.get("$base/{key}/version/{version}/process-definition", key, version)
            .andExpect {
                status { isOk() }
                content { json("[]") }
            }

        verify(buildingBlockProcessService).getProcessDefinitionsForBuildingBlock(eq(key), eq(version))
    }

    @Test
    @WithMockUser
    @DisplayName("should return 200 with list when process definitions exist")
    fun shouldReturn200WithListWhenProcessDefinitionsExist() {
        val item = BuildingBlockProcessDefinitionDto(
            id = processDefinitionId,
            key = key,
            name = "Example process",
            versionTag = version,
            main = true
        )
        whenever(buildingBlockProcessService.getProcessDefinitionsForBuildingBlock(eq(key), eq(version)))
            .thenReturn(listOf(item))

        mockMvc.get("$base/{key}/version/{version}/process-definition", key, version)
            .andExpect {
                status { isOk() }
                jsonPath("$", hasSize<Any>(1))
                jsonPath("$[0].id") { value(processDefinitionId) }
                jsonPath("$[0].key") { value(key) }
                jsonPath("$[0].versionTag") { value(version) }
                jsonPath("$[0].main") { value(true) }
            }

        verify(buildingBlockProcessService).getProcessDefinitionsForBuildingBlock(eq(key), eq(version))
    }

    @Test
    @WithMockUser
    @DisplayName("should return 200 when process definition with links exists")
    fun shouldReturn200WhenProcessDefinitionWithLinksExists() {
        val proc = ProcessDefinitionWithPropertiesDto()
        val dto = BuildingBlockProcessDefinitionWithLinksDto(
            processDefinition = proc,
            processLinks = emptyList(),
            bpmn20Xml = "<definitions/>"
        )

        whenever(
            buildingBlockProcessService.getProcessDefinitionWithProcessLinks(
                eq(key),
                eq(version),
                eq(processDefinitionId)
            )
        ).thenReturn(dto)

        mockMvc.get(
            "$base/{key}/version/{version}/process-definition/{processDefinitionId}",
            key,
            version,
            processDefinitionId
        ).andExpect {
            status { isOk() }
            jsonPath("$.bpmn20Xml") { value("<definitions/>") }
        }

        verify(buildingBlockProcessService).getProcessDefinitionWithProcessLinks(eq(key), eq(version), eq(processDefinitionId))
    }

    @Test
    @WithMockUser
    @DisplayName("should return 404 when process definition with links not found")
    fun shouldReturn404WhenProcessDefinitionWithLinksNotFound() {
        whenever(
            buildingBlockProcessService.getProcessDefinitionWithProcessLinks(
                eq(key),
                eq(version),
                eq(processDefinitionId)
            )
        ).thenReturn(null)

        mockMvc.get(
            "$base/{key}/version/{version}/process-definition/{processDefinitionId}",
            key,
            version,
            processDefinitionId
        ).andExpect {
            status { isNotFound() }
        }

        verify(buildingBlockProcessService).getProcessDefinitionWithProcessLinks(eq(key), eq(version), eq(processDefinitionId))
    }

    @Test
    @WithMockUser
    @DisplayName("should deploy process definition with file and links and return 204")
    fun shouldDeployProcessDefinitionWithFileAndLinksAndReturn204() {
        val bpmn = MockMultipartFile(
            "file",
            "process.bpmn",
            "application/xml",
            "<definitions/>".toByteArray(StandardCharsets.UTF_8)
        )

        val linksJson = objectMapper.writeValueAsBytes(emptyList<ProcessLinkCreateRequestDto>())
        val linksPart = MockPart("processLinks", linksJson).apply { headers.contentType = MediaType.APPLICATION_JSON }

        val idPart = MockMultipartFile(
            "processDefinitionId",
            "",
            MediaType.TEXT_PLAIN_VALUE,
            processDefinitionId.toByteArray(StandardCharsets.UTF_8)
        )

        val mainPart = MockPart("main", "true".toByteArray(StandardCharsets.UTF_8)).apply {
            headers.contentType = MediaType.APPLICATION_JSON
        }

        mockMvc.multipart("$base/{key}/version/{version}/process-definition/{processDefinitionId}", key, version, processDefinitionId) {
            file(bpmn)
            file(idPart)
            part(linksPart)
            part(mainPart)
            contentType = MediaType.MULTIPART_FORM_DATA
            accept = MediaType.APPLICATION_JSON
        }.andExpect {
            status { isNoContent() }
        }

        verify(buildingBlockProcessService).deployProcessDefinitionAndProcessLinks(
            eq(key),
            eq(version),
            any(),
            any(),
            eq(processDefinitionId),
            eq(true)
        )
    }

    @Test
    @WithMockUser
    @DisplayName("should deploy process definition without file and return 204")
    fun shouldDeployProcessDefinitionWithoutFileAndReturn204() {
        val linksJson = objectMapper.writeValueAsBytes(emptyList<ProcessLinkCreateRequestDto>())
        val linksPart = MockPart("processLinks", linksJson).apply { headers.contentType = MediaType.APPLICATION_JSON }

        val idPart = MockMultipartFile(
            "processDefinitionId",
            "",
            MediaType.TEXT_PLAIN_VALUE,
            processDefinitionId.toByteArray(StandardCharsets.UTF_8)
        )

        val mainPart = MockPart("main", "false".toByteArray(StandardCharsets.UTF_8)).apply {
            headers.contentType = MediaType.APPLICATION_JSON
        }

        mockMvc.multipart("$base/{key}/version/{version}/process-definition/{processDefinitionId}", key, version, processDefinitionId) {
            file(idPart)
            part(linksPart)
            part(mainPart)
            contentType = MediaType.MULTIPART_FORM_DATA
            accept = MediaType.APPLICATION_JSON
        }.andExpect {
            status { isNoContent() }
        }

        verify(buildingBlockProcessService).deployProcessDefinitionAndProcessLinks(
            eq(key),
            eq(version),
            isNull(),
            any(),
            eq(processDefinitionId),
            eq(false)
        )
    }

    @Test
    @WithMockUser
    @DisplayName("should deploy process definition with default main false and return 204")
    fun shouldDeployProcessDefinitionWithDefaultMainFalseAndReturn204() {
        val linksJson = objectMapper.writeValueAsBytes(emptyList<ProcessLinkCreateRequestDto>())
        val linksPart = MockPart("processLinks", linksJson).apply { headers.contentType = MediaType.APPLICATION_JSON }

        val idPart = MockMultipartFile(
            "processDefinitionId",
            "",
            MediaType.TEXT_PLAIN_VALUE,
            processDefinitionId.toByteArray(StandardCharsets.UTF_8)
        )

        mockMvc.multipart("$base/{key}/version/{version}/process-definition/{processDefinitionId}", key, version, processDefinitionId) {
            file(idPart)
            part(linksPart)
            contentType = MediaType.MULTIPART_FORM_DATA
            accept = MediaType.APPLICATION_JSON
        }.andExpect {
            status { isNoContent() }
        }

        verify(buildingBlockProcessService).deployProcessDefinitionAndProcessLinks(
            eq(key),
            eq(version),
            isNull(),
            any(),
            eq(processDefinitionId),
            eq(false)
        )
    }
}