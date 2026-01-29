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

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.buildingblock.service.BuildingBlockManagementService
import com.ritense.exporter.ExportService
import com.ritense.importer.ImportService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import org.springframework.mock.web.MockMultipartFile
import java.time.LocalDateTime

@ExtendWith(MockitoExtension::class)
class BuildingBlockManagementResourceTest {

    @Test
    fun `import should only pass final building block ids`() {
        val repository = mock<BuildingBlockDefinitionRepository>()
        val managementService = mock<BuildingBlockManagementService>()
        val importService = mock<ImportService>()
        val exportService = mock<ExportService>()
        val resource = BuildingBlockManagementResource(
            repository,
            managementService,
            importService,
            exportService
        )

        val finalDefinition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId("my-bb", Semver.parse("2.0.0")!!),
            name = "Final BB",
            description = "final",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = true
        )
        val draftDefinition = BuildingBlockDefinition(
            id = BuildingBlockDefinitionId("my-bb", Semver.parse("2.1.0")!!),
            name = "Draft BB",
            description = "draft",
            createdBy = "tester@ritense.com",
            createdDate = LocalDateTime.now(),
            basedOnVersionTag = null,
            final = false
        )
        whenever(repository.findAll()).thenReturn(listOf(finalDefinition, draftDefinition))

        val file = MockMultipartFile(
            "file",
            "building-block.zip",
            "application/zip",
            "test".toByteArray(Charsets.UTF_8)
        )

        resource.import(file)

        val idCaptor = argumentCaptor<List<BuildingBlockDefinitionId>>()
        verify(importService).importBuildingBlockDefinitions(any(), idCaptor.capture())
        assertThat(idCaptor.firstValue).containsExactly(finalDefinition.id)
    }
}
