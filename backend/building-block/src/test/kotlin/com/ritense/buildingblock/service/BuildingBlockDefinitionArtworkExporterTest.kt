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

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinitionArtwork
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.exporter.request.BuildingBlockDocumentDefinitionExportRequest
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.whenever
import java.nio.charset.StandardCharsets
import java.util.Base64
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class BuildingBlockDefinitionArtworkExporterTest(
    @Mock private val repository: BuildingBlockDefinitionRepository,
) {

    private lateinit var exporter: BuildingBlockDefinitionArtworkExporter
    private val buildingBlockDefinitionId = BuildingBlockDefinitionId("bb-art", "1.0.0")

    @BeforeEach
    fun setUp() {
        exporter = BuildingBlockDefinitionArtworkExporter(repository)
    }

    @Test
    fun `should export artwork`() {
        val definition = BuildingBlockDefinition(
            id = buildingBlockDefinitionId,
            name = "Artwork BB",
            description = null
        )
        val imageBytes = "logo-binary".toByteArray(StandardCharsets.UTF_8)
        definition.artwork = BuildingBlockDefinitionArtwork(
            id = buildingBlockDefinitionId,
            definition = definition,
            imageBase64 = Base64.getEncoder().encodeToString(imageBytes)
        )

        whenever(repository.findById(buildingBlockDefinitionId)).thenReturn(Optional.of(definition))

        val result = exporter.export(
            BuildingBlockDocumentDefinitionExportRequest(
                name = "document-definition",
                buildingBlockDefinitionId = buildingBlockDefinitionId
            )
        )

        assertThat(result.exportFiles).hasSize(1)
        val exportFile = result.exportFiles.first()
        assertThat(exportFile.path).isEqualTo(
            "config/building-block/bb-art/1-0-0/building-block/artwork.png"
        )
        assertThat(exportFile.content).isEqualTo(imageBytes)
        assertThat(result.relatedRequests).isEmpty()
    }

    @Test
    fun `should return empty result when artwork is missing`() {
        val definition = BuildingBlockDefinition(
            id = buildingBlockDefinitionId,
            name = "Artwork BB",
            description = null
        )
        definition.artwork = null

        whenever(repository.findById(buildingBlockDefinitionId)).thenReturn(Optional.of(definition))

        val result = exporter.export(
            BuildingBlockDocumentDefinitionExportRequest(
                name = "document-definition",
                buildingBlockDefinitionId = buildingBlockDefinitionId
            )
        )

        assertThat(result.exportFiles).isEmpty()
        assertThat(result.relatedRequests).isEmpty()
    }
}
