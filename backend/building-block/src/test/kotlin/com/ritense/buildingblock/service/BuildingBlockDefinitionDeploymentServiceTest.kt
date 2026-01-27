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
import com.ritense.importer.ValtimoImportService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.api.io.TempDir
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import org.springframework.context.ApplicationEventPublisher
import org.springframework.core.io.FileSystemResource
import org.springframework.core.io.support.ResourcePatternResolver
import java.nio.file.Files
import java.nio.file.Path
import java.time.LocalDateTime

@ExtendWith(MockitoExtension::class)
class BuildingBlockDefinitionDeploymentServiceTest {

    @TempDir
    lateinit var tempDir: Path

    @Test
    fun `should only pass final building block ids during startup deployment`() {
        val definitionFile = tempDir.resolve(
            "config/building-block/test-bb/1-0-0/definition/test-bb.building-block-definition.json"
        )
        Files.createDirectories(definitionFile.parent)
        Files.writeString(definitionFile, "{}")
        val resource = FileSystemResource(definitionFile.toFile())

        val resourceLoader = mock<ResourcePatternResolver>()
        whenever(resourceLoader.getResources(any())).thenReturn(arrayOf(resource))

        val importService = mock<ValtimoImportService>()
        val repository = mock<BuildingBlockDefinitionRepository>()
        val publisher = mock<ApplicationEventPublisher>()
        val objectMapper = mock<ObjectMapper>()

        val finalDefinition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId("test-bb", Semver.parse("1.0.0")!!),
            name = "Final BB",
            description = "final",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = true
        )
        val draftDefinition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId("test-bb", Semver.parse("1.1.0")!!),
            name = "Draft BB",
            description = "draft",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        whenever(repository.findAll()).thenReturn(listOf(finalDefinition, draftDefinition))

        val service = BuildingBlockDefinitionDeploymentService(
            resourceLoader,
            importService,
            repository,
            publisher,
            objectMapper
        )

        service.deployOnStartup()

        val idCaptor = argumentCaptor<List<BuildingBlockDefinitionId>>()
        verify(importService).importBuildingBlockDefinition(any(), idCaptor.capture())
        assertThat(idCaptor.firstValue).containsExactly(finalDefinition.id)
    }
}
