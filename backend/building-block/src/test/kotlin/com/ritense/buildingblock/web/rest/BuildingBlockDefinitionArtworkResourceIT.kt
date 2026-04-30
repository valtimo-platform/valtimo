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
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinitionArtwork
import com.ritense.buildingblock.repository.BuildingBlockDefinitionArtworkRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionArtworkDto
import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionArtworkDto
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import jakarta.transaction.Transactional
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.semver4j.Semver
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.delete
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.time.LocalDateTime
import java.util.Base64
import javax.imageio.ImageIO

@Transactional
class BuildingBlockDefinitionArtworkResourceIT @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper,
    private val buildingBlockDefinitionArtworkRepository: BuildingBlockDefinitionArtworkRepository
) : BaseIntegrationTest() {

    private val base = "/api/management/v1/building-block"
    private val key = "artwork-bb-it"
    private val version = "2.0.0"

    @BeforeEach
    fun setup() {
        buildingBlockDefinitionArtworkRepository.deleteAll()
        buildingBlockDefinitionRepository.deleteAll()
        buildingBlockDefinitionRepository.saveAndFlush(
            BuildingBlockDefinition(
                id = BuildingBlockDefinitionId(key, Semver.parse(version)!!),
                name = "Artwork Test Block",
                description = "desc",
                createdBy = "tester",
                createdDate = LocalDateTime.now(),
                basedOnVersionTag = null,
                final = false
            )
        )
    }

    @Test
    @WithMockUser
    fun `should return 404 when artwork does not exist`() {
        mockMvc.get("$base/{key}/version/{versionTag}/artwork", key, version)
            .andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser
    fun `should create artwork normalize image and return dto`() {
        val base64 = createPngDataUrl(32, 32)
        val dto = CreateBuildingBlockDefinitionArtworkDto(imageBase64 = base64)

        val mvcResult = mockMvc.post("$base/{key}/version/{versionTag}/artwork", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(dto)
        }.andExpect {
            status { isOk() }
            jsonPath("$.key") { value(key) }
            jsonPath("$.versionTag") { value(version) }
        }.andReturn()

        val response = objectMapper.readValue(
            mvcResult.response.contentAsByteArray,
            BuildingBlockDefinitionArtworkDto::class.java
        )
        val stored = buildingBlockDefinitionArtworkRepository.findById(
            BuildingBlockDefinitionId(key, Semver.parse(version)!!)
        ).orElseThrow()

        assertThat(response.imageBase64).isEqualTo(stored.imageBase64)

        val decoded = Base64.getDecoder().decode(stored.imageBase64)
        val image = ImageIO.read(decoded.inputStream())
        assertThat(image.width).isBetween(1, 1024)
        assertThat(image.height).isBetween(1, 1024)
    }

    @Test
    @WithMockUser
    fun `should resize large images`() {
        val base64 = createPngDataUrl(4000, 2000)
        val dto = CreateBuildingBlockDefinitionArtworkDto(imageBase64 = base64)

        mockMvc.post("$base/{key}/version/{versionTag}/artwork", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(dto)
        }.andExpect { status { isOk() } }

        val stored = buildingBlockDefinitionArtworkRepository.findById(
            BuildingBlockDefinitionId(key, Semver.parse(version)!!)
        ).orElseThrow()

        val decoded = Base64.getDecoder().decode(stored.imageBase64)
        val image = ImageIO.read(decoded.inputStream())
        assertThat(image.width).isLessThanOrEqualTo(1024)
        assertThat(image.height).isLessThanOrEqualTo(1024)
    }

    @Test
    @WithMockUser
    fun `should reject invalid base64`() {
        val dto = CreateBuildingBlockDefinitionArtworkDto(imageBase64 = "notbase64")

        mockMvc.post("$base/{key}/version/{versionTag}/artwork", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(dto)
        }.andExpect {
            status { isInternalServerError() }
            jsonPath("$.detail") { value("Invalid base64 image data") }
        }
    }

    @Test
    @WithMockUser
    fun `should delete artwork`() {
        val definition = buildingBlockDefinitionRepository.findById(
            BuildingBlockDefinitionId(key, Semver.parse(version)!!)
        ).orElseThrow()

        val imageBytes = createPngBytes(16, 16)
        val artwork = BuildingBlockDefinitionArtwork(
            definition = definition,
            imageBase64 = Base64.getEncoder().encodeToString(imageBytes),
            id = BuildingBlockDefinitionId(key, Semver.parse(version)!!)
        )

        buildingBlockDefinitionArtworkRepository.saveAndFlush(artwork)
        assertThat(buildingBlockDefinitionArtworkRepository.findById(definition.id)).isPresent

        mockMvc.delete("$base/{key}/version/{versionTag}/artwork", key, version)
            .andExpect { status { isNoContent() } }

        assertThat(buildingBlockDefinitionArtworkRepository.findById(definition.id)).isEmpty
    }

    @Test
    @WithMockUser
    fun `should remove artwork when definition is deleted`() {
        val id = BuildingBlockDefinitionId(key, Semver.parse(version)!!)
        val definition = buildingBlockDefinitionRepository.findById(id).orElseThrow()

        val imageBytes = createPngBytes(10, 10)
        val artwork = BuildingBlockDefinitionArtwork(
            id = id,
            definition = definition,
            imageBase64 = Base64.getEncoder().encodeToString(imageBytes)
        )
        definition.artwork = artwork
        buildingBlockDefinitionRepository.saveAndFlush(definition)

        assertThat(buildingBlockDefinitionArtworkRepository.findById(id)).isPresent

        buildingBlockDefinitionRepository.delete(definition)
        buildingBlockDefinitionRepository.flush()

        assertThat(buildingBlockDefinitionArtworkRepository.findById(id)).isEmpty
    }

    private fun createPngBytes(width: Int, height: Int): ByteArray {
        val image = BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB)
        val g = image.createGraphics()
        g.color = Color.RED
        g.fillRect(0, 0, width, height)
        g.dispose()
        return ByteArrayOutputStream().use {
            ImageIO.write(image, "png", it)
            it.toByteArray()
        }
    }

    private fun createPngDataUrl(width: Int, height: Int): String {
        val bytes = createPngBytes(width, height)
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes)
    }
}
