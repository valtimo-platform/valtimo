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
 * distributed under the License is distributed on an "AS IS" basis,
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
import com.ritense.processlink.web.rest.dto.ProcessLinkResponseDto
import com.ritense.valtimo.web.rest.dto.ProcessDefinitionWithPropertiesDto
import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
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
    fun `should return 200 with empty list when no process definitions found`() {
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
    fun `should return 200 when process definitions exist`() {
        val dto = BuildingBlockProcessDefinitionDto(
            id = "pd-1",
            key = "process-key",
            name = "Process name",
            versionTag = "v1",
            main = true
        )
        whenever(buildingBlockProcessService.getProcessDefinitionsForBuildingBlock(eq(key), eq(version)))
            .thenReturn(listOf(dto))

        mockMvc.get("$base/{key}/version/{version}/process-definition", key, version)
            .andExpect {
                status { isOk() }
                jsonPath("$", hasSize<Any>(1))
                jsonPath("$[0].id") { value("pd-1") }
                jsonPath("$[0].key") { value("process-key") }
                jsonPath("$[0].main") { value(true) }
            }

        verify(buildingBlockProcessService).getProcessDefinitionsForBuildingBlock(eq(key), eq(version))
    }

    @Test
    @WithMockUser
    fun `should return 200 when process definition with links exists`() {
        val proc = ProcessDefinitionWithPropertiesDto()
        val superCls = proc.javaClass.superclass
        superCls.getDeclaredField("id").apply { isAccessible = true }.set(proc, processDefinitionId)
        superCls.getDeclaredField("key").apply { isAccessible = true }.set(proc, key)
        superCls.getDeclaredField("name").apply { isAccessible = true }.set(proc, "Example process")
        superCls.getDeclaredField("versionTag").apply { isAccessible = true }.set(proc, version)
        proc.setReadOnly(false)

        val withLinks = BuildingBlockProcessDefinitionWithLinksDto(
            processDefinition = proc,
            processLinks = listOf<ProcessLinkResponseDto>(),
            bpmn20Xml = "<definitions/>"
        )

        whenever(
            buildingBlockProcessService.getProcessDefinitionWithProcessLinks(
                eq(key),
                eq(version),
                eq(processDefinitionId)
            )
        ).thenReturn(withLinks)

        mockMvc.get(
            "$base/{key}/version/{version}/process-definition/{processDefinitionId}",
            key,
            version,
            processDefinitionId
        ).andExpect {
            status { isOk() }
            jsonPath("$.processDefinition.id") { value(processDefinitionId) }
            jsonPath("$.processDefinition.key") { value(key) }
            jsonPath("$.processDefinition.name") { value("Example process") }
            jsonPath("$.processDefinition.versionTag") { value(version) }
            jsonPath("$.bpmn20Xml") { value("<definitions/>") }
        }

        verify(buildingBlockProcessService).getProcessDefinitionWithProcessLinks(eq(key), eq(version), eq(processDefinitionId))
    }

    @Test
    @WithMockUser
    fun `should return 404 when process definition with links not found`() {
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
    fun `should deploy process definition with file and links and return 204`() {
        val bpmn = MockMultipartFile(
            "file",
            "process.bpmn",
            "application/xml",
            "<definitions/>".toByteArray()
        )

        val links: List<ProcessLinkCreateRequestDto> = emptyList()
        val linksJson = objectMapper.writeValueAsBytes(links)
        val linksPart = MockPart("processLinks", linksJson).apply { headers.contentType = MediaType.APPLICATION_JSON }

        val idJsonString = "\"$processDefinitionId\"".toByteArray()
        val idPart = MockPart("processDefinitionId", idJsonString).apply { headers.contentType = MediaType.APPLICATION_JSON }

        val mainJson = "true".toByteArray()
        val mainPart = MockPart("main", mainJson).apply { headers.contentType = MediaType.APPLICATION_JSON }

        mockMvc.multipart("$base/{key}/version/{version}/process-definition/{processDefinitionId}", key, version, processDefinitionId) {
            file(bpmn)
            part(linksPart)
            part(idPart)
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
            eq("\"$processDefinitionId\""),
            eq(true)
        )
    }
}