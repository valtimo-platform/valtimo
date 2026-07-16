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

import com.ritense.buildingblock.BaseIntegrationTest
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.hamcrest.Matchers.contains
import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.security.test.context.support.WithMockUser
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional

@Transactional
class BuildingBlockFieldResourceIT @Autowired constructor(
    private val mockMvc: MockMvc,
    private val documentDefinitionRepository: JsonSchemaDocumentDefinitionRepository
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
                "applicantName": { "type": "string" },
                "applicantAddress": {
                  "type": "object",
                  "properties": {
                    "city": { "type": "string" },
                    "postalCode": { "type": "string" }
                  },
                  "required": ["city"]
                }
              },
              "required": ["applicantAddress"]
            }
        """.trimIndent()
        val schema = JsonSchema.fromString(schemaJson)
        documentDefinitionRepository.save(JsonSchemaDocumentDefinition(id, schema))
    }

    @Test
    @WithMockUser
    fun `should return object nodes and their nested leaves with required marker`() {
        mockMvc.perform(
            get("/api/management/v1/building-block/${buildingBlockId.key}/version/${buildingBlockId.versionTag}/fields")
                .accept(MediaType.APPLICATION_JSON)
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$").isArray)
            .andExpect(jsonPath("$", hasSize<Any>(4)))
            .andExpect(
                jsonPath(
                    "$[*].name",
                    // object container nodes are selectable and the list is returned sorted alphabetically
                    contains(
                        "/applicantAddress",
                        "/applicantAddress/city",
                        "/applicantAddress/postalCode",
                        "/applicantName"
                    )
                )
            )
            .andExpect(jsonPath("$[?(@.name == '/applicantName')].required", contains(false)))
            .andExpect(jsonPath("$[?(@.name == '/applicantAddress')].required", contains(true)))
            .andExpect(jsonPath("$[?(@.name == '/applicantAddress/city')].required", contains(true)))
            .andExpect(jsonPath("$[?(@.name == '/applicantAddress/postalCode')].required", contains(false)))
    }
}
