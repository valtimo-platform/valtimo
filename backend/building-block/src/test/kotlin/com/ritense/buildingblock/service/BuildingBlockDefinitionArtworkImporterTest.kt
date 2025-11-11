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

import com.ritense.buildingblock.web.rest.dto.CreateBuildingBlockDefinitionArtworkDto
import com.ritense.importer.ImportRequest
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_ARTWORK
import com.ritense.importer.ValtimoImportTypes.Companion.BUILDING_BLOCK_DEFINITION
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import java.util.Base64

@ExtendWith(MockitoExtension::class)
class BuildingBlockDefinitionArtworkImporterTest(
    @Mock private val artworkService: BuildingBlockDefinitionArtworkService
) {

    private lateinit var importer: BuildingBlockDefinitionArtworkImporter

    @BeforeEach
    fun setUp() {
        importer = BuildingBlockDefinitionArtworkImporter(artworkService)
    }

    @Test
    fun `should be of artwork type and depend on building block definition`() {
        assertThat(importer.type()).isEqualTo(BUILDING_BLOCK_ARTWORK)
        assertThat(importer.dependsOn()).isEqualTo(setOf(BUILDING_BLOCK_DEFINITION))
    }

    @Test
    fun `should support single png in artwork root folder`() {
        assertThat(importer.supports("/artwork/icon.png")).isTrue()
        assertThat(
            importer.supports(
                "config/building-block/my-bb/0.1.0/artwork/icon.png"
            )
        ).isTrue()
    }

    @Test
    fun `should not support nested or non-png artwork paths`() {
        assertThat(importer.supports("/artwork/nested/icon.png")).isFalse()
        assertThat(importer.supports("/artwork/icon.jpg")).isFalse()
        assertThat(importer.supports("/artwork/icon.png.bak")).isFalse()
    }

    @Test
    fun `should create artwork with base64 encoded content`() {
        val id = BuildingBlockDefinitionId("block-key", "1.0.0")
        val content = byteArrayOf(1, 2, 3, 4)
        val request = ImportRequest(
            fileName = "artwork/icon.png",
            content = content,
            buildingBlockDefinitionId = id
        )

        importer.import(request)

        val dtoCaptor = argumentCaptor<CreateBuildingBlockDefinitionArtworkDto>()
        verify(artworkService).createArtwork(
            eq("block-key"),
            eq("1.0.0"),
            dtoCaptor.capture()
        )

        val expectedBase64 = Base64.getEncoder().encodeToString(content)
        assertThat(dtoCaptor.firstValue.imageBase64).isEqualTo(expectedBase64)
    }
}