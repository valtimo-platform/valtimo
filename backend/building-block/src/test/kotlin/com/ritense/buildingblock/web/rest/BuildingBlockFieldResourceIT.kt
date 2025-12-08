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
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.hamcrest.CoreMatchers.equalTo
import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

class BuildingBlockFieldResourceIT @Autowired constructor(
    private val mockMvc: MockMvc,
    private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository,
    private val objectMapper: ObjectMapper
) : BaseIntegrationTest() {

    private val buildingBlockId = BuildingBlockDefinitionId.of("bb", "1.0.0")

    @BeforeEach
    fun setup() {
        val id = JsonSchemaDocumentDefinitionId.forBuildingBlock(buildingBlockId.key, buildingBlockId)
        val schemaJson = """
            {
              "${'$'}id": "bb.schema",
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "type": "object",
              "properties": {
                "firstName": { "type": "string" },
                "lastName": { "type": "string" }
              },
              "required": ["firstName"]
            }
        """.trimIndent()
        val schema = JsonSchema.fromString(schemaJson)
        documentDefinitionRepository.save(JsonSchemaDocumentDefinition(id, schema))
    }

    @AfterEach
    fun teardown() {
        documentDefinitionRepository.deleteAll()
    }

    @Test
    @WithMockUser
    fun `should return fields with required marker`() {
        mockMvc.perform(
            get("/api/management/v1/building-block/${buildingBlockId.key}/version/${buildingBlockId.versionTag}/fields")
                .accept(MediaType.APPLICATION_JSON)
        )
            .andExpect {
                status().isOk()
                jsonPath("$").isArray
                jsonPath("$", hasSize<Any>(2))
                jsonPath("$[0].name", equalTo("firstName"))
                jsonPath("$[0].required", equalTo(true))
                jsonPath("$[1].name", equalTo("lastName"))
                jsonPath("$[1].required", equalTo(false))
            }
    }
}
