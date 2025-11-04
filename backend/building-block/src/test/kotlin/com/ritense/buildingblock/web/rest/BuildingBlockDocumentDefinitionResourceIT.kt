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

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.buildingblock.domain.impl.BuildingBlockJsonSchemaDocumentDefinitionId
import com.ritense.buildingblock.repository.BuildingBlockJsonSchemaDocumentDefinitionRepository
import com.ritense.document.domain.impl.BuildingBlockJsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.put
import java.util.Optional

class BuildingBlockDocumentDefinitionResourceIT @Autowired constructor(
    private val mockMvc: MockMvc,
    private val objectMapper: ObjectMapper
) : BaseIntegrationTest() {

    @MockitoBean
    lateinit var repository: BuildingBlockJsonSchemaDocumentDefinitionRepository

    private val base = "/api/management/v1/building-block"
    private val key = "bb-key"
    private val version = "1.0.0"

    @Test
    @WithMockUser
    fun `should return 404 when document definition is missing`() {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, version)
        val id = BuildingBlockJsonSchemaDocumentDefinitionId(key, buildingBlockId)
        whenever(repository.findById(eq(id))).thenReturn(Optional.empty())

        mockMvc.get("$base/{key}/version/{version}/document", key, version)
            .andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser
    fun `should return 200 with schema when document definition exists`() {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, version)
        val id = BuildingBlockJsonSchemaDocumentDefinitionId(key, buildingBlockId)
        val schemaJson = """{"title":"My Schema","type":"object"}"""
        val entity = BuildingBlockJsonSchemaDocumentDefinition(id, JsonSchema.fromString(schemaJson))
        whenever(repository.findById(eq(id))).thenReturn(Optional.of(entity))

        mockMvc.get("$base/{key}/version/{version}/document", key, version)
            .andExpect {
                status { isOk() }
                content { json(schemaJson) }
            }

        verify(repository).findById(eq(id))
    }

    @Test
    @WithMockUser
    fun `should update document definition and return 200 with saved schema`() {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, version)
        val id = BuildingBlockJsonSchemaDocumentDefinitionId(key, buildingBlockId)
        val newSchema: JsonNode = objectMapper.readTree("""{"title":"Updated","type":"object","properties":{"a":{"type":"string"}}}""")

        whenever(repository.save(any())).thenAnswer { it.arguments[0] as BuildingBlockJsonSchemaDocumentDefinition }

        mockMvc.put("$base/{key}/version/{version}/document", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(newSchema)
        }.andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(newSchema)) }
        }

        val captor = argumentCaptor<BuildingBlockJsonSchemaDocumentDefinition>()
        verify(repository).save(captor.capture())
        val saved = captor.firstValue
        assert(saved.id().name() == key)
        assert(saved.id().buildingBlockDefinitionId().key == key)
        assert(saved.id().buildingBlockDefinitionId().versionTag.toString() == version)
    }

    @Test
    @WithMockUser
    fun `should accept minimal empty object schema on update`() {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, version)
        val id = BuildingBlockJsonSchemaDocumentDefinitionId(key, buildingBlockId)
        val minimalSchema: JsonNode = objectMapper.readTree("""{"type":"object"}""")

        whenever(repository.save(any())).thenAnswer { it.arguments[0] as BuildingBlockJsonSchemaDocumentDefinition }

        mockMvc.put("$base/{key}/version/{version}/document", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(minimalSchema)
        }.andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(minimalSchema)) }
        }

        verify(repository).save(any())
    }
}