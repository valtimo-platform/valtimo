package com.ritense.buildingblock.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import java.time.LocalDateTime
import java.util.Optional

class BuildingBlockManagementResourceIT @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper
): BaseIntegrationTest() {

    @MockitoBean
    lateinit var buildingBlockManagementService: BuildingBlockManagementService

    @MockitoBean
    lateinit var buildingBlockDefinitionRepository: BuildingBlockDefinitionRepository

    private val base = "/api/management/v1/building-block"
    private val key = "my-bb"
    private val version = "2.0.0"

    private lateinit var dto: BuildingBlockDefinitionDto

    @BeforeEach
    fun setup() {
        dto = BuildingBlockDefinitionDto(
            key = key,
            versionTag = version,
            title = "My Building Block",
            description = "desc",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
    }

    @Test
    @WithMockUser
    @DisplayName("should return 404 when list is empty")
    fun shouldReturn404WhenListIsEmpty() {
        whenever(buildingBlockManagementService.getLatestPerKey()).thenReturn(emptyList())

        mockMvc.get(base)
            .andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser
    @DisplayName("should return list when elements exist")
    fun shouldReturnListWhenElementsExist() {
        whenever(buildingBlockManagementService.getLatestPerKey()).thenReturn(listOf(dto))

        mockMvc.get(base)
            .andExpect {
                status { isOk() }
                jsonPath("\$[0].key") { value(key) }
                jsonPath("\$[0].versionTag") { value(version) }
                jsonPath("\$[0].title") { value("My Building Block") }
            }
    }

    @Test
    @WithMockUser
    @DisplayName("should create definition and return 200 with body")
    fun shouldCreateDefinitionAndReturn200WithBody() {
        val body = mapOf(
            "key" to key,
            "versionTag" to version,
            "title" to "My Building Block",
            "description" to "desc"
        )

        whenever(buildingBlockManagementService.create(any())).thenReturn(dto)

        mockMvc.post(base) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(body)
        }.andExpect {
            status { isOk() }
            jsonPath("$.key") { value(key) }
            jsonPath("$.versionTag") { value(version) }
            jsonPath("$.title") { value("My Building Block") }
        }
    }

    @Test
    @WithMockUser
    @DisplayName("should return 200 when definition exists")
    fun shouldReturn200WhenDefinitionExists() {
        val entity = com.ritense.buildingblock.domain.definition.BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(key, Semver.parse(version)!!),
            title = "My Building Block",
            description = "desc",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        whenever(buildingBlockDefinitionRepository.findById(eq(entity.id)))
            .thenReturn(Optional.of(entity))

        mockMvc.get("$base/{k}/version/{v}", key, version)
            .andExpect {
                status { isOk() }
                jsonPath("$.key") { value(key) }
                jsonPath("$.versionTag") { value(version) }
                jsonPath("$.title") { value("My Building Block") }
            }
    }

    @Test
    @WithMockUser
    @DisplayName("should return 404 when definition not found")
    fun shouldReturn404WhenDefinitionNotFound() {
        val id = BuildingBlockDefinitionId(key, Semver.parse(version)!!)
        whenever(buildingBlockDefinitionRepository.findById(eq(id)))
            .thenReturn(Optional.empty())

        mockMvc.get("$base/{k}/version/{v}", key, version)
            .andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser
    @DisplayName("should update and return 200 with updated body")
    fun shouldUpdateAndReturn200WithUpdatedBody() {
        val body = mapOf("title" to "Updated Title", "description" to "Updated desc")
        val updated = dto.copy(title = "Updated Title", description = "Updated desc")

        whenever(buildingBlockManagementService.update(eq(key), eq(version), any()))
            .thenReturn(updated)

        mockMvc.put("$base/{k}/version/{v}", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(body)
        }.andExpect {
            status { isOk() }
            jsonPath("$.title") { value("Updated Title") }
            jsonPath("$.description") { value("Updated desc") }
        }
    }

    @Test
    @WithMockUser
    @DisplayName("should return 404 when update target not found")
    fun shouldReturn404WhenUpdateTargetNotFound() {
        whenever(buildingBlockManagementService.update(eq(key), eq(version), any()))
            .thenReturn(null)

        mockMvc.put("$base/{k}/version/{v}", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(mapOf("title" to "irrelevant"))
        }.andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser
    @DisplayName("should create then get then update then list definitions")
    fun shouldCreateThenGetThenUpdateThenListDefinitions() {
        whenever(buildingBlockManagementService.create(any())).thenReturn(dto)
        mockMvc.post(base) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(
                mapOf("key" to key, "versionTag" to version, "title" to "My Building Block")
            )
        }.andExpect { status { isOk() } }

        val entity = com.ritense.buildingblock.domain.definition.BuildingBlockDefinition(
            id = BuildingBlockDefinitionId(key, Semver.parse(version)!!),
            title = "My Building Block",
            description = "desc",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        whenever(buildingBlockDefinitionRepository.findById(eq(entity.id)))
            .thenReturn(Optional.of(entity))

        mockMvc.get("$base/{k}/version/{v}", key, version)
            .andExpect { status { isOk() } }

        val updated = dto.copy(title = "Updated Title", description = "Updated desc")
        whenever(buildingBlockManagementService.update(eq(key), eq(version), any())).thenReturn(updated)
        mockMvc.put("$base/{k}/version/{v}", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(mapOf("title" to "Updated Title"))
        }.andExpect { status { isOk() } }

        whenever(buildingBlockManagementService.getLatestPerKey()).thenReturn(listOf(updated))
        mockMvc.get(base)
            .andExpect {
                status { isOk() }
                jsonPath("\$[0].title") { value("Updated Title") }
            }
    }
}