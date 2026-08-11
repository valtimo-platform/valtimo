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

package com.ritense.buildingblock.web.rest

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.case_.service.migration.CaseMigrationService
import com.ritense.case_.service.migration.MigrationPlanExporter
import com.ritense.case_.service.migration.MigrationPlanImporter
import com.ritense.case_.service.migration.MigrationSuggestionService
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

@ExtendWith(MockitoExtension::class)
class BuildingBlockMigrationManagementResourceTest {

    private val suggestionService = mock<MigrationSuggestionService>()

    private val resource = BuildingBlockMigrationManagementResource(
        mock<CaseMigrationService>(),
        mock<MigrationPlanImporter>(),
        mock<MigrationPlanExporter>(),
        suggestionService,
    )

    private val owner = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.4")
    private val nested = BuildingBlockDefinitionId("inspectie-fotos", "1.0.1")

    @Test
    fun `an add suggestion moves data and process from the owner building block into the nested one`() {
        whenever(suggestionService.suggestBuildingBlockEntry(any(), any()))
            .thenReturn(ObjectMapper().createObjectNode())

        resource.suggestBuildingBlockEntry(owner.key, owner.versionTag.toString(), nested.key, nested.versionTag.toString(), "add")

        verify(suggestionService).suggestBuildingBlockEntry(eq(owner), eq(nested))
    }

    @Test
    fun `a remove suggestion moves them back from the nested building block to its owner`() {
        whenever(suggestionService.suggestBuildingBlockEntry(any(), any()))
            .thenReturn(ObjectMapper().createObjectNode())

        resource.suggestBuildingBlockEntry(owner.key, owner.versionTag.toString(), nested.key, nested.versionTag.toString(), "remove")

        verify(suggestionService).suggestBuildingBlockEntry(eq(nested), eq(owner))
    }
}
