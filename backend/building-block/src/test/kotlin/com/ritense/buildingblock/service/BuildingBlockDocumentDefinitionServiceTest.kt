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

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.repository.impl.JsonSchemaDocumentDefinitionRepository
import com.ritense.document.service.result.DeployDocumentDefinitionResultSucceeded
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class BuildingBlockDocumentDefinitionServiceTest {

    @Mock
    private lateinit var repository: JsonSchemaDocumentDefinitionRepository

    @Mock
    private lateinit var definitionChecker: BuildingBlockDefinitionChecker

    private val objectMapper = ObjectMapper()

    private lateinit var service: BuildingBlockDocumentDefinitionService

    @BeforeEach
    fun setUp() {
        service = BuildingBlockDocumentDefinitionService(repository, definitionChecker, objectMapper)
    }

    @Test
    fun `deploy should override schema id when it does not match building block key`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("my-block", "1.0.0")
        val schema = JsonSchema.fromString(
            """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "wrong-name.schema",
              "type": "object",
              "properties": {}
            }
            """.trimIndent()
        )

        val captor = argumentCaptor<JsonSchemaDocumentDefinition>()
        whenever(repository.saveAndFlush(any<JsonSchemaDocumentDefinition>())).thenAnswer { it.arguments[0] }

        val result = service.deploy(schema, buildingBlockDefinitionId)

        assertThat(result).isInstanceOf(DeployDocumentDefinitionResultSucceeded::class.java)
        verify(repository).saveAndFlush(captor.capture())

        val deployed = captor.firstValue
        assertThat(deployed.id.name()).isEqualTo("my-block")
        assertThat(deployed.getSchema().asJson().get("\$id").asText()).isEqualTo("my-block.schema")
    }

    @Test
    fun `deploy should not modify schema when id already matches building block key`() {
        val buildingBlockDefinitionId = BuildingBlockDefinitionId.of("my-block", "1.0.0")
        val schema = JsonSchema.fromString(
            """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "my-block.schema",
              "type": "object",
              "properties": { "name": { "type": "string" } }
            }
            """.trimIndent()
        )

        val captor = argumentCaptor<JsonSchemaDocumentDefinition>()
        whenever(repository.saveAndFlush(any<JsonSchemaDocumentDefinition>())).thenAnswer { it.arguments[0] }

        val result = service.deploy(schema, buildingBlockDefinitionId)

        assertThat(result).isInstanceOf(DeployDocumentDefinitionResultSucceeded::class.java)
        verify(repository).saveAndFlush(captor.capture())

        val deployed = captor.firstValue
        assertThat(deployed.id.name()).isEqualTo("my-block")
        assertThat(deployed.getSchema().asJson().get("\$id").asText()).isEqualTo("my-block.schema")
    }
}
