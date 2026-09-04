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

package com.ritense.buildingblock.service.migration

import com.fasterxml.jackson.databind.ObjectMapper
import com.ritense.buildingblock.domain.CaseDefinitionBuildingBlockLink
import com.ritense.buildingblock.repository.CaseDefinitionBuildingBlockLinkRepository
import com.ritense.case_.service.migration.DataMigrationComponentSuggester
import com.ritense.processdocument.migration.ProcessMigrationComponentSuggester
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/** The dissolve suggestion must cover the whole subtree the owner stops modelling (G25) and aim each entry at the owner that block really hands back to. */
class RemoveBuildingBlockMigrationComponentSuggesterTest {

    private lateinit var caseLinkRepository: CaseDefinitionBuildingBlockLinkRepository
    private lateinit var linkResolver: LinkedBuildingBlockVersionResolver
    private lateinit var dataSuggester: DataMigrationComponentSuggester
    private lateinit var processSuggester: ProcessMigrationComponentSuggester
    private lateinit var suggester: RemoveBuildingBlockMigrationComponentSuggester

    private val source = CaseDefinitionId("bijstand", "1.0.1")
    private val target = CaseDefinitionId("bijstand", "1.0.2")

    private val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
    private val besluit = BuildingBlockDefinitionId.of("bijstand-besluit", "1.0.0")

    @BeforeEach
    fun setUp() {
        caseLinkRepository = mock()
        linkResolver = mock()
        dataSuggester = mock()
        processSuggester = mock()
        whenever(caseLinkRepository.findAllByCaseDefinitionId(any())).thenReturn(emptyList())
        whenever(linkResolver.resolveCallActivityDeclarers(any())).thenReturn(emptyMap())
        whenever(dataSuggester.suggestForBuildingBlockEntry(any(), any(), any())).thenReturn(null)
        whenever(processSuggester.suggestForBuildingBlockEntry(any(), any(), any())).thenReturn(null)
        // The real level rules over the mocked resolver: an unstubbed walk answers empty, so they are inert.
        suggester = RemoveBuildingBlockMigrationComponentSuggester(
            ObjectMapper(),
            caseLinkRepository,
            linkResolver,
            BuildingBlockEntryLevel(linkResolver),
            dataSuggester,
            processSuggester,
        )
    }

    @Test
    fun `should report the plan component key it fills`() {
        assertThat(suggester.componentKey()).isEqualTo("removeBuildingBlock")
    }

    @Test
    fun `should suggest an entry for every level the owner stops modelling, nested ones included`() {
        // source models uitvoeren (its own call activity) and besluit (declared by uitvoeren); target neither.
        declares(source, uitvoeren to source, besluit to uitvoeren)

        val suggestion = suggester.suggest(source, target) as List<SuggestedRemoveBuildingBlockEntry>

        assertThat(suggestion.map { it.buildingBlockKey })
            .containsExactlyInAnyOrder("bijstand-uitvoeren", "bijstand-besluit")
        assertThat(suggestion.map { it.buildingBlockVersionTag }).containsOnly("1.0.0")
    }

    @Test
    fun `should compute a nested entry's mapping against its parent block, not the migrating case`() {
        declares(source, uitvoeren to source, besluit to uitvoeren)

        suggester.suggest(source, target)

        // The nested block hands back one level, to uitvoeren.
        verify(dataSuggester).suggestForBuildingBlockEntry(eq(besluit), eq(uitvoeren), any())
        verify(processSuggester).suggestForBuildingBlockEntry(eq(besluit), eq(uitvoeren), any())
        // The first-level block hands back to the owner on the version it ends up on.
        verify(dataSuggester).suggestForBuildingBlockEntry(eq(uitvoeren), eq(target), any())
    }

    @Test
    fun `should not suggest removing a block the target still models`() {
        declares(source, uitvoeren to source, besluit to uitvoeren)
        declares(target, uitvoeren to target)

        val suggestion = suggester.suggest(source, target) as List<SuggestedRemoveBuildingBlockEntry>

        assertThat(suggestion.map { it.buildingBlockKey }).containsExactly("bijstand-besluit")
    }

    @Test
    fun `should suggest removing a block the owner only offered as a startable item`() {
        // Stubbed before it is handed to another stub: a nested `whenever` inside `thenReturn` fails as an unfinished stubbing.
        val startableLink = mock<CaseDefinitionBuildingBlockLink>()
        whenever(startableLink.buildingBlockDefinitionId).thenReturn(besluit)
        whenever(caseLinkRepository.findAllByCaseDefinitionId(source)).thenReturn(listOf(startableLink))

        val suggestion = suggester.suggest(source, target) as List<SuggestedRemoveBuildingBlockEntry>

        assertThat(suggestion.map { it.buildingBlockKey }).containsExactly("bijstand-besluit")
    }

    @Test
    fun `should suggest nothing when the owner loses no blocks`() {
        declares(source, uitvoeren to source)
        declares(target, uitvoeren to target)

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should not suggest dissolving a block whose call activity now names another key`() {
        // One call activity re-pointed at a different block: alignment carries the instance across at @500, and dissolving at @400 would take it away first.
        declares(source, uitvoeren to source)
        onActivity(source, "CallUitvoerenActivity" to uitvoeren)
        onActivity(target, "CallUitvoerenActivity" to besluit)

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should not suggest dissolving a block below a parent block both versions model`() {
        // The nested block is the parent's own change, run by alignment at @500 — after this plan's @400 would have dissolved it against the parent's old schema.
        declares(source, uitvoeren to source, besluit to uitvoeren)
        declares(target, uitvoeren to target)
        reaches(source, uitvoeren, besluit)
        reaches(target, uitvoeren)

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should still suggest dissolving a nested block whose parent is dissolved too`() {
        // The parent is going too, so nothing survives to carry the child (G25). Both entries belong here.
        declares(source, uitvoeren to source, besluit to uitvoeren)
        reaches(source, uitvoeren, besluit)

        val suggestion = suggester.suggest(source, target) as List<SuggestedRemoveBuildingBlockEntry>

        assertThat(suggestion.map { it.buildingBlockKey })
            .containsExactlyInAnyOrder("bijstand-uitvoeren", "bijstand-besluit")
    }

    @Test
    fun `should keep a process row the suggester could not pair, rather than dropping it`() {
        // A block whose process is not handed back cannot be dissolved, so dropping the row fails every case from an entry that reads as complete.
        declares(source, uitvoeren to source)
        whenever(processSuggester.suggestForBuildingBlockEntry(eq(uitvoeren), any(), any())).thenReturn(
            listOf(mapOf("sourceProcessDefinitionKey" to "bijstand-uitvoeren-process", "mapActivities" to emptyMap<String, String>()))
        )

        val suggestion = suggester.suggest(source, target) as List<SuggestedRemoveBuildingBlockEntry>

        assertThat(suggestion.single().processMigration.single().get("sourceProcessDefinitionKey").asText())
            .isEqualTo("bijstand-uitvoeren-process")
        assertThat(suggestion.single().processMigration.single().hasNonNull("targetProcessDefinitionKey")).isFalse()
    }

    private fun declares(owner: BlueprintId, vararg edges: Pair<BuildingBlockDefinitionId, BlueprintId>) {
        whenever(linkResolver.resolveCallActivityDeclarers(owner)).thenReturn(edges.toMap())
    }

    private fun onActivity(owner: BlueprintId, vararg edges: Pair<String, BuildingBlockDefinitionId>) {
        whenever(linkResolver.resolveCallActivityDeclaredBlocks(owner)).thenReturn(edges.toMap())
    }

    private fun reaches(owner: BlueprintId, vararg blocks: BuildingBlockDefinitionId) {
        whenever(linkResolver.resolveCallActivityReachable(owner)).thenReturn(blocks.toSet())
    }
}
