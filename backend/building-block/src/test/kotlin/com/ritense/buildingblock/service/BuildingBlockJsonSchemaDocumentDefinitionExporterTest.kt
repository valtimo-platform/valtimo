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

package com.ritense.buildingblock.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.document.domain.impl.JsonSchema
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.service.impl.JsonSchemaDocumentDefinitionService
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.whenever
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class BuildingBlockJsonSchemaDocumentDefinitionExporterTest(
    @Mock private val documentDefinitionService: JsonSchemaDocumentDefinitionService,
) {

    private val objectMapper = ObjectMapper()
    private lateinit var exporter: BuildingBlockJsonSchemaDocumentDefinitionExporter

    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("bb-schema", "1.0.0")

    @BeforeEach
    fun setUp() {
        exporter = BuildingBlockJsonSchemaDocumentDefinitionExporter(objectMapper, documentDefinitionService)
    }

    @Test
    fun `should export document definition schema`() {
        val schemaJson = """
            {
              "${'$'}schema": "http://json-schema.org/draft-07/schema#",
              "${'$'}id": "document-definition.schema",
              "type": "object"
            }
        """.trimIndent()
        val schema = JsonSchema.fromString(schemaJson)
        val documentDefinitionId =
            JsonSchemaDocumentDefinitionId.forBuildingBlock("document-definition", buildingBlockDefinitionId)
        val documentDefinition = JsonSchemaDocumentDefinition(documentDefinitionId, schema)

        whenever(documentDefinitionService.findBy(documentDefinitionId)).thenReturn(Optional.of(documentDefinition))

        val result = exporter.export(
            BuildingBlockDocumentDefinitionExportRequest(
                name = "document-definition",
                buildingBlockDefinitionId = buildingBlockDefinitionId
            )
        )

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path).isEqualTo(
            "config/building-block/bb-schema/1-0-0/document/definition/document-definition.schema.document-definition.json"
        )

        val exportedSchema = objectMapper.readTree(exportFile.content)
        assertThat(exportedSchema.get("\$id").asText()).isEqualTo("document-definition.schema")
        assertThat(result.relatedRequests).isEmpty()
    }
}
