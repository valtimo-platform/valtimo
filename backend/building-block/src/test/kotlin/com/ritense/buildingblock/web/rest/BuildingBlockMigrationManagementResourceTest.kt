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
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
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
    private val deeper = BuildingBlockDefinitionId("inspectie-dossier", "1.0.0")

    @BeforeEach
    fun setUp() {
        whenever(suggestionService.suggestBuildingBlockEntry(any(), any()))
            .thenReturn(ObjectMapper().createObjectNode())
        whenever(suggestionService.describeEntryOwner(any())).thenReturn(ObjectMapper().createObjectNode())
        // No nesting unless a test says so: the entry's owner is the blueprint being migrated.
        whenever(suggestionService.entryOwnerOf(any(), any()))
            .thenAnswer { invocation -> invocation.getArgument<BlueprintId>(0) }
    }

    @Test
    fun `an add suggestion moves data and process from the owner building block into the nested one`() {
        suggest(mode = "add", block = nested)

        verify(suggestionService).suggestBuildingBlockEntry(eq(owner), eq(nested))
    }

    @Test
    fun `a remove suggestion moves them back from the nested building block to its owner`() {
        suggest(mode = "remove", block = nested)

        verify(suggestionService).suggestBuildingBlockEntry(eq(nested), eq(owner))
    }

    @Test
    fun `an entry two levels down exchanges state with the block in between, not with this plan's block`() {
        whenever(suggestionService.entryOwnerOf(any(), eq(deeper))).thenReturn(nested)

        suggest(mode = "remove", block = deeper)

        verify(suggestionService).suggestBuildingBlockEntry(eq(deeper), eq(nested))
    }

    @Test
    fun `a removal reads the tree of the version that still models the block - the plan's source`() {
        val source = BuildingBlockDefinitionId("verhuizing-inspectie", "1.0.3")

        suggest(mode = "remove", block = nested, sourceVersionTag = "1.0.3")

        verify(suggestionService).entryOwnerOf(eq(source), eq(nested))
    }

    @Test
    fun `an addition reads the tree of the version that models it - this plan's own`() {
        suggest(mode = "add", block = nested, sourceVersionTag = "1.0.3")

        verify(suggestionService).entryOwnerOf(eq(owner), eq(nested))
    }

    @Test
    fun `the suggestion says which owner it was computed against, so the editor can scope its pickers`() {
        val response = suggest(mode = "remove", block = nested)

        assertThat(response.body?.has("owner")).isTrue()
    }

    private fun suggest(mode: String, block: BuildingBlockDefinitionId, sourceVersionTag: String? = null) =
        resource.suggestBuildingBlockEntry(
            owner.key,
            owner.versionTag.toString(),
            block.key,
            block.versionTag.toString(),
            mode,
            null,
            sourceVersionTag,
        )
}
