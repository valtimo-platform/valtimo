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
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.valtimo.contract.authentication.AuthoritiesConstants.ADMIN
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.put
import java.time.LocalDateTime

class BuildingBlockDocumentDefinitionResourceIT @Autowired constructor(
    private val mockMvc: MockMvc,
    private val repository: JsonSchemaDocumentDefinitionRepository,
    private val objectMapper: ObjectMapper
) : BaseIntegrationTest() {
    private val base = "/api/management/v1/building-block"
    private val key = "bb-key"
    private val version = "1.0.0"

    @BeforeEach
    fun setUp() {
        val buildingBlock = BuildingBlockDefinition(
            BuildingBlockDefinitionId.of(key, version),
            "Test Building Block",
            "Test building block for document definition tests",
            "Test Author",
            LocalDateTime.now(),
        )
        buildingBlockDefinitionRepository.save(buildingBlock)
    }

    @AfterEach
    fun cleanUp() {
        repository.deleteAll()
        buildingBlockDefinitionRepository.deleteAll()
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should return 404 when document definition is missing`() {
        mockMvc.get("$base/{key}/version/{version}/document", key, "1.0.1")
            .andExpect { status { isNotFound() } }
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should return 200 with schema when document definition exists`() {
        val buildingBlockId = BuildingBlockDefinitionId.of(key, version)
        val id = JsonSchemaDocumentDefinitionId.forBuildingBlock(key, buildingBlockId)
        val schemaJson = """{"${'$'}id": "$key.schema", "title":"My Schema","type":"object"}"""
        val entity = JsonSchemaDocumentDefinition(id, JsonSchema.fromString(schemaJson))


        repository.save(entity)

        mockMvc.get("$base/{key}/version/{version}/document", key, version)
            .andExpect {
                status { isOk() }
                content { json(schemaJson) }
            }
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should update document definition and return 200 with saved schema`() {
        val newSchema: JsonNode = objectMapper.readTree("""{"${'$'}id": "bb-key.schema", "title":"Updated","type":"object","properties":{"a":{"type":"string"}}}""")

        mockMvc.put("$base/{key}/version/{version}/document", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(newSchema)
        }.andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(newSchema)) }
        }
    }

    @Test
    @WithMockUser(username = "admin@ritense.com", authorities = [ADMIN])
    fun `should accept minimal empty object schema on update`() {
        val minimalSchema: JsonNode = objectMapper.readTree("""{"${'$'}id": "bb-key.schema", "type":"object"}""")

        mockMvc.put("$base/{key}/version/{version}/document", key, version) {
            contentType = MediaType.APPLICATION_JSON
            content = objectMapper.writeValueAsBytes(minimalSchema)
        }.andExpect {
            status { isOk() }
            content { json(objectMapper.writeValueAsString(minimalSchema)) }
        }
    }
}