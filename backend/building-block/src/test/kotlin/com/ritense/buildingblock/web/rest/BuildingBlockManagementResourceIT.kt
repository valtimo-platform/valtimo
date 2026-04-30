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
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import java.time.LocalDateTime
import java.util.Optional

class BuildingBlockManagementResourceIT @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper
) : BaseIntegrationTest() {

    private val base = "/api/management/v1/building-block"
    private val key = "my-bb"
    private val version = "2.0.0"

    private lateinit var dto: BuildingBlockDefinitionDto

    @BeforeEach
    fun setup() {
        dto = BuildingBlockDefinitionDto(
            key = key,
            versionTag = version,
            name = "My Building Block",
            description = "desc",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        doReturn("process-id")
            .whenever(buildingBlockProcessService)
            .createEmptyProcessAndLink(any(), any(), any())
        doReturn(mock<JsonSchemaDocumentDefinition>())
            .whenever(buildingBlockDocumentDefinitionService)
            .ensureEmptyFor(any(), any())
    }

    @Test
    @WithMockUser
    fun `should return 404 when list is empty`() {
        doReturn(emptyList<BuildingBlockDefinition>())
            .whenever(buildingBlockDefinitionRepository)
            .findAll()

        mockMvc.get(base)
            .andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser
    fun `should return list when elements exist`() {
        val def = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(key, Semver.parse(version)!!),
            name = "My Building Block",
            description = "desc",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        doReturn(listOf(def))
            .whenever(buildingBlockDefinitionRepository)
            .findAll()

        mockMvc.get(base)
            .andExpect {
                status { isOk() }
                jsonPath("\$[0].key") { value(key) }
                jsonPath("\$[0].versionTag") { value(version) }
                jsonPath("\$[0].name") { value("My Building Block") }
            }
    }

    @Test
    @WithMockUser
    fun `should create definition and return 200 with body`() {
        val body = mapOf(
            "key" to key,
            "versionTag" to version,
            "name" to "My Building Block",
            "description" to "desc"
        )
        val saved = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(key, Semver.parse(version)!!),
            name = "My Building Block",
            description = "desc",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        doReturn(saved)
            .whenever(buildingBlockDefinitionRepository)
            .saveAndFlush(any())

        mockMvc.post(base) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(body)
        }.andExpect {
            status { isOk() }
            jsonPath("$.key") { value(key) }
            jsonPath("$.versionTag") { value(version) }
            jsonPath("$.name") { value("My Building Block") }
        }
    }

    @Test
    @WithMockUser
    fun `should return 200 when definition exists`() {
        val entity = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(key, Semver.parse(version)!!),
            name = "My Building Block",
            description = "desc",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        doReturn(Optional.of(entity))
            .whenever(buildingBlockDefinitionRepository)
            .findById(eq(entity.id))

        mockMvc.get("$base/{k}/version/{v}", key, version)
            .andExpect {
                status { isOk() }
                jsonPath("$.key") { value(key) }
                jsonPath("$.versionTag") { value(version) }
                jsonPath("$.name") { value("My Building Block") }
            }
    }

    @Test
    @WithMockUser
    fun `should return 404 when definition not found`() {
        val id = BuildingBlockDefinitionId(key, Semver.parse(version)!!)
        doReturn(Optional.empty<BuildingBlockDefinition>())
            .whenever(buildingBlockDefinitionRepository)
            .findById(eq(id))

        mockMvc.get("$base/{k}/version/{v}", key, version)
            .andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser
    fun `should update and return 200 with updated body`() {
        val body = mapOf("name" to "Updated name", "description" to "Updated desc")
        val existing = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(key, Semver.parse(version)!!),
            name = "My Building Block",
            description = "desc",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        val updated = BuildingBlockDefinition(
            id = existing.id,
            name = "Updated name",
            description = "Updated desc",
            createdBy = existing.createdBy,
            createdDate = existing.createdDate,
            basedOnVersionTag = existing.basedOnVersionTag,
            final = existing.final
        )
        doReturn(Optional.of(existing))
            .whenever(buildingBlockDefinitionRepository)
            .findById(eq(existing.id))
        doReturn(updated)
            .whenever(buildingBlockDefinitionRepository)
            .save(any())

        mockMvc.put("$base/{k}/version/{v}", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(body)
        }.andExpect {
            status { isOk() }
            jsonPath("$.name") { value("Updated name") }
            jsonPath("$.description") { value("Updated desc") }
        }
    }

    @Test
    @WithMockUser
    fun `should return 404 when update target not found`() {
        val id = BuildingBlockDefinitionId(key, Semver.parse(version)!!)
        doReturn(Optional.empty<BuildingBlockDefinition>())
            .whenever(buildingBlockDefinitionRepository)
            .findById(eq(id))

        mockMvc.put("$base/{k}/version/{v}", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(mapOf("name" to "irrelevant"))
        }.andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser
    fun `should create empty document definition on creation`() {
        val body = mapOf(
            "key" to key,
            "versionTag" to version,
            "name" to "My Building Block",
            "description" to "desc"
        )
        val saved = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(key, Semver.parse(version)!!),
            name = "My Building Block",
            description = "desc",
            createdBy = null,
            createdDate = null,
            basedOnVersionTag = null,
            final = false
        )
        doReturn(saved)
            .whenever(buildingBlockDefinitionRepository)
            .saveAndFlush(any())

        mockMvc.post(base) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(body)
        }.andExpect { status { isOk() } }

        verify(buildingBlockDocumentDefinitionService).ensureEmptyFor(eq(key), eq(version))
    }

    @Test
    @WithMockUser
    fun `should create empty process definition marked as main on creation`() {
        val body = mapOf(
            "key" to key,
            "versionTag" to version,
            "name" to "My Building Block",
            "description" to "desc"
        )
        val saved = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(key, Semver.parse(version)!!),
            name = "My Building Block",
            description = "desc",
            createdBy = null,
            createdDate = null,
            basedOnVersionTag = null,
            final = false
        )
        doReturn(saved)
            .whenever(buildingBlockDefinitionRepository)
            .saveAndFlush(any())

        mockMvc.post(base) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(body)
        }.andExpect { status { isOk() } }

        verify(buildingBlockProcessService).createEmptyProcessAndLink(eq("My Building Block"), eq(key), eq(version))
    }

    @Test
    @WithMockUser
    fun `should create draft version`() {
        val newVersion = "2.1.0"
        val draftDto = dto.copy(versionTag = newVersion, basedOnVersionTag = version, final = false)
        doReturn(draftDto).whenever(buildingBlockManagementService).createDraft(key, version, newVersion)

        mockMvc.post("$base/{key}/version/{version}/draft", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(mapOf("versionTag" to newVersion))
        }.andExpect {
            status { isOk() }
            jsonPath("$.versionTag") { value(newVersion) }
            jsonPath("$.basedOnVersionTag") { value(version) }
            jsonPath("$.final") { value(false) }
        }

        verify(buildingBlockManagementService).createDraft(key, version, newVersion)
    }
}
