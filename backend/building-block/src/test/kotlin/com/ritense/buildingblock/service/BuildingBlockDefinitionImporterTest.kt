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
import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.web.rest.dto.BuildingBlockDefinitionDto
import com.ritense.importer.ImportRequest
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionChecker
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class BuildingBlockDefinitionImporterTest(
    @Mock private val objectMapper: ObjectMapper,
    @Mock private val repository: BuildingBlockDefinitionRepository,
    @Mock private val buildingBlockDefinitionChecker: BuildingBlockDefinitionChecker
) {
    private lateinit var importer: BuildingBlockDefinitionImporter

    @BeforeEach
    fun before() {
        importer = BuildingBlockDefinitionImporter(objectMapper, repository, buildingBlockDefinitionChecker)
    }

    @Test
    fun `should be of type 'form-definition'`() {
        assertThat(importer.type()).isEqualTo("buildingblockdefinition")
    }

    @Test
    fun `should not depend on any type`() {
        assertThat(importer.dependsOn()).isEqualTo(emptySet<String>())
    }

    @Test
    fun `should support document definition fileName`() {
        assertThat(importer.supports(FILENAME)).isTrue()
    }

    @Test
    fun `should not support invalid document definition fileName`() {
        assertThat(importer.supports("/building-block/definition/not/test.building-block-definition.json")).isFalse()
        assertThat(importer.supports("/building-block/definition/test-building-block-definition.json")).isFalse()
    }


    @Test
    fun `should finalize building block when dto is final after import`() {
        val id = BuildingBlockDefinitionId("bb-key", "1.0.0")
        val jsonContent = """{"key":"bb-key","versionTag":"1.0.0"}"""
        val bytes = jsonContent.toByteArray(Charsets.UTF_8)
        val request = ImportRequest(
            fileName = FILENAME,
            content = bytes
        )

        val dto = mock<BuildingBlockDefinitionDto>()
        whenever(dto.getBuildingBlockDefinitionId()).thenReturn(id)
        whenever(dto.final).thenReturn(true)

        val initialEntity = BuildingBlockDefinition(
            id = id,
            name = "Test BB",
            description = "desc",
            createdBy = null,
            createdDate = null,
            basedOnVersionTag = null,
            final = true
        )

        whenever(dto.toEntity()).thenReturn(initialEntity)
        whenever(
            objectMapper.readValue(
                any<String>(),
                eq(BuildingBlockDefinitionDto::class.java)
            )
        ).thenReturn(dto)

        val draftEntity = initialEntity.copy(final = false)
        whenever(repository.findById(id)).thenReturn(Optional.of(draftEntity))

        importer.import(request)
        importer.afterImport(request)

        val captor = argumentCaptor<BuildingBlockDefinition>()
        verify(repository, times(2)).save(captor.capture())

        val savedAfterFinalization = captor.allValues.last()
        assertThat(savedAfterFinalization.id).isEqualTo(id)
        assertThat(savedAfterFinalization.final).isTrue()
    }

    private companion object {
        const val FILENAME = "/building-block/definition/test.building-block-definition.json"
    }
}