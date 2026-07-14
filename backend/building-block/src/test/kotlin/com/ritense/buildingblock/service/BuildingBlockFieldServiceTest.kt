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

package com.ritense.buildingblock.service

import com.ritense.buildingblock.processlink.dto.BuildingBlockFieldDto
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import java.util.Optional
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class BuildingBlockFieldServiceTest {

    @Mock
    private lateinit var repository: JsonSchemaDocumentDefinitionRepository

    private lateinit var service: BuildingBlockFieldService

    private val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("bb", "1.0.0")

    @BeforeEach
    fun setUp() {
        service = BuildingBlockFieldService(repository)
    }

    @Test
    fun `should return leaf fields for a flat schema`() {
        stubSchema(
            """
            {
              "properties": {
                "firstName": { "type": "string" },
                "lastName": { "type": "string" }
              },
              "required": ["firstName"]
            }
            """.trimIndent()
        )

        val fields = service.getFields(buildingBlockDefinitionId)

        assertThat(fields).containsExactlyInAnyOrder(
            BuildingBlockFieldDto(name = "/firstName", required = true),
            BuildingBlockFieldDto(name = "/lastName", required = false)
        )
    }

    @Test
    fun `should include the object node itself alongside its leaf properties`() {
        stubSchema(
            """
            {
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
        )

        val fields = service.getFields(buildingBlockDefinitionId)

        assertThat(fields).containsExactlyInAnyOrder(
            BuildingBlockFieldDto(name = "/applicantName", required = false),
            // the object container node is now selectable, so a whole subtree can be mapped
            BuildingBlockFieldDto(name = "/applicantAddress", required = true),
            BuildingBlockFieldDto(name = "/applicantAddress/city", required = true),
            BuildingBlockFieldDto(name = "/applicantAddress/postalCode", required = false)
        )
    }

    @Test
    fun `should include every object node in a deeply nested schema`() {
        stubSchema(
            """
            {
              "properties": {
                "applicant": {
                  "type": "object",
                  "properties": {
                    "address": {
                      "type": "object",
                      "properties": {
                        "city": { "type": "string" }
                      }
                    }
                  }
                }
              }
            }
            """.trimIndent()
        )

        val fields = service.getFields(buildingBlockDefinitionId)

        assertThat(fields.map { it.name }).containsExactlyInAnyOrder(
            "/applicant",
            "/applicant/address",
            "/applicant/address/city"
        )
    }

    @Test
    fun `should return fields sorted alphabetically by name`() {
        stubSchema(
            """
            {
              "properties": {
                "zeta": { "type": "string" },
                "alpha": {
                  "type": "object",
                  "properties": {
                    "gamma": { "type": "string" },
                    "beta": { "type": "string" }
                  }
                },
                "delta": { "type": "string" }
              }
            }
            """.trimIndent()
        )

        val fields = service.getFields(buildingBlockDefinitionId)

        assertThat(fields.map { it.name }).containsExactly(
            "/alpha",
            "/alpha/beta",
            "/alpha/gamma",
            "/delta",
            "/zeta"
        )
    }

    @Test
    fun `should not emit an entry for the root object`() {
        stubSchema(
            """
            {
              "properties": {
                "name": { "type": "string" }
              }
            }
            """.trimIndent()
        )

        val fields = service.getFields(buildingBlockDefinitionId)

        assertThat(fields.map { it.name }).doesNotContain("", "/")
    }

    @Test
    fun `should include the array node itself without duplicates`() {
        stubSchema(
            """
            {
              "properties": {
                "tags": {
                  "type": "array",
                  "items": { "type": "string" }
                }
              }
            }
            """.trimIndent()
        )

        val fields = service.getFields(buildingBlockDefinitionId)

        assertThat(fields).containsExactly(
            BuildingBlockFieldDto(name = "/tags", required = false)
        )
    }

    @Test
    fun `should return empty list when no document definition exists`() {
        whenever(repository.findById(any())).thenReturn(Optional.empty())

        val fields = service.getFields(buildingBlockDefinitionId)

        assertThat(fields).isEmpty()
    }

    private fun stubSchema(properties: String) {
        val id = JsonSchemaDocumentDefinitionId.forBuildingBlock(
            buildingBlockDefinitionId.key,
            buildingBlockDefinitionId
        )
        val schemaJson = """
            {
              "${'$'}id": "${id.name()}.schema",
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "type": "object",
              ${properties.trim().removePrefix("{").removeSuffix("}").trim()}
            }
        """.trimIndent()
        val schema = JsonSchema.fromString(schemaJson)
        whenever(repository.findById(any())).thenReturn(
            Optional.of(JsonSchemaDocumentDefinition(id, schema))
        )
    }
}