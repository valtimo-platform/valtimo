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
import com.ritense.valtimo.migration.domain.ProcessMigrationInstruction
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/** The suggestion must carry the whole subtree, over both link kinds — a block the target only offers as a startable item is an entry no other component supplies (G69). */
class AddBuildingBlockMigrationComponentSuggesterTest {

    private lateinit var linkResolver: LinkedBuildingBlockVersionResolver
    private lateinit var linkRepository: CaseDefinitionBuildingBlockLinkRepository
    private lateinit var dataSuggester: DataMigrationComponentSuggester
    private lateinit var processSuggester: ProcessMigrationComponentSuggester
    private lateinit var suggester: AddBuildingBlockMigrationComponentSuggester

    private val source = CaseDefinitionId("bijstand", "1.0.0")
    private val target = CaseDefinitionId("bijstand", "1.0.1")

    private val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
    private val besluit = BuildingBlockDefinitionId.of("bijstand-besluit", "1.0.0")

    @BeforeEach
    fun setUp() {
        linkResolver = mock()
        linkRepository = mock()
        dataSuggester = mock()
        processSuggester = mock()
        whenever(dataSuggester.suggest(any(), any())).thenReturn(null)
        whenever(dataSuggester.suggestForBuildingBlockEntry(any(), any(), any())).thenReturn(null)
        // Its own `adoptionAccountsFor` answers nothing for a call-activity block, which is most of these cases.
        whenever(processSuggester.suggestForBuildingBlockEntry(any(), any(), any())).thenReturn(null)
        whenever(linkResolver.resolveCallActivityReachable(any())).thenReturn(emptySet())
        // The real level rules over the mocked resolver: an unstubbed walk answers empty, so they are inert.
        suggester = AddBuildingBlockMigrationComponentSuggester(
            ObjectMapper(),
            linkRepository,
            linkResolver,
            BuildingBlockEntryLevel(linkResolver),
            dataSuggester,
            processSuggester,
        )
    }

    @Test
    fun `should report the plan component key it fills`() {
        assertThat(suggester.componentKey()).isEqualTo("addBuildingBlock")
    }

    @Test
    fun `should suggest an entry per newly declared block, nested ones included, with no processMigration`() {
        declares(target, uitvoeren to target, besluit to uitvoeren)

        val suggestion = suggester.suggest(source, target) as List<SuggestedAddBuildingBlockEntry>

        assertThat(suggestion).hasSize(2)
        assertThat(suggestion.map { it.buildingBlockKey })
            .containsExactly("bijstand-besluit", "bijstand-uitvoeren")
        assertThat(suggestion.map { it.buildingBlockVersionTag }).containsOnly("1.0.0")
        // Adoption locates the process from the link; naming a key would only repeat it.
        assertThat(suggestion).allSatisfy({ assertThat(it.processMigration).isEmpty() })
    }

    @Test
    fun `should suggest an entry for a block the target only offers as a startable item`() {
        // Nothing else supplies it: adoption needs a call activity, and alignment only ever upgrades a block that already exists (G69).
        startable(target, besluit)

        val suggestion = suggester.suggest(source, target) as List<SuggestedAddBuildingBlockEntry>

        assertThat(suggestion.map { it.buildingBlockKey }).containsExactly("bijstand-besluit")
        verify(dataSuggester).suggestForBuildingBlockEntry(eq(target), eq(besluit), any())
    }

    @Test
    fun `should carry the suggested hijack of a startable-item block, read off the source the instances still run`() {
        startable(target, besluit)
        whenever(processSuggester.suggestForBuildingBlockEntry(eq(target), eq(besluit), eq(source)))
            .thenReturn(listOf(ProcessMigrationInstruction("bijstand", "bijstand-besluit-process")))

        val suggestion = suggester.suggest(source, target) as List<SuggestedAddBuildingBlockEntry>

        assertThat(suggestion.single().processMigration.map { it.get("targetProcessDefinitionKey").asText() })
            .containsExactly("bijstand-besluit-process")
    }

    @Test
    fun `should keep a suggested row whose counterpart was not guessed`() {
        // Dropping it would turn an entry its own save path refuses into one that looks complete.
        startable(target, besluit)
        whenever(processSuggester.suggestForBuildingBlockEntry(any(), any(), any()))
            .thenReturn(listOf(mapOf("sourceProcessDefinitionKey" to "bijstand")))

        val suggestion = suggester.suggest(source, target) as List<SuggestedAddBuildingBlockEntry>

        assertThat(suggestion.single().processMigration.single().has("targetProcessDefinitionKey")).isFalse()
    }

    @Test
    fun `should not suggest a block the source already offered as a startable item`() {
        startable(source, besluit)
        startable(target, besluit)

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should not suggest a startable item the target now declares on a call activity instead`() {
        // Same key, another mechanism: the instance exists, so this is alignment's job (R2) and adoption's.
        startable(source, uitvoeren)
        declares(target, uitvoeren to target)

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should fill a nested block from its parent block, and a first-level one from the owner`() {
        // A nested block is created from the document of the block above it. The owner's side is its target version: `dataMigration` runs at @100 and this at @300.
        declares(target, uitvoeren to target, besluit to uitvoeren)

        suggester.suggest(source, target)

        verify(dataSuggester).suggestForBuildingBlockEntry(eq(uitvoeren), eq(besluit), any())
        verify(dataSuggester).suggestForBuildingBlockEntry(eq(target), eq(uitvoeren), any())
    }

    @Test
    fun `should not suggest a block the source already declared`() {
        models(source, uitvoeren)
        declares(target, uitvoeren to target, besluit to target)

        val suggestion = suggester.suggest(source, target) as List<SuggestedAddBuildingBlockEntry>

        assertThat(suggestion.map { it.buildingBlockKey }).containsExactly("bijstand-besluit")
    }

    @Test
    fun `should suggest nothing for a block the source already models at another version`() {
        // A version bump is alignment's job (R2) and needs a plan for the jump (R3); an entry for it would be a no-op that now also warns for having reached nothing.
        models(source, BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0"))
        declares(target, BuildingBlockDefinitionId.of("bijstand-uitvoeren", "2.0.0") to target)

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should not suggest creating a block a call activity was merely re-pointed at`() {
        // The same call activity, another key: alignment carries the instance across, so there is nothing to create.
        models(source, uitvoeren)
        declares(target, besluit to target)
        onActivity(source, "CallUitvoerenActivity" to uitvoeren)
        onActivity(target, "CallUitvoerenActivity" to besluit)

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should not suggest creating a block below a parent block both versions model`() {
        // The parent's own plan declares it; this plan would create a block from a document that is not the one it will be filled from.
        models(source, uitvoeren)
        reaches(target, uitvoeren, besluit)
        declares(target, uitvoeren to target, besluit to uitvoeren)

        assertThat(suggester.suggest(source, target)).isNull()
    }

    @Test
    fun `should suggest nothing when the target declares no new blocks`() {
        models(source, uitvoeren)
        declares(target, uitvoeren to target)

        assertThat(suggester.suggest(source, target)).isNull()
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

    /** Declared on a call activity by [owner] itself, and so also reachable — the two agree in the real resolver. */
    private fun models(owner: BlueprintId, vararg blocks: BuildingBlockDefinitionId) {
        reaches(owner, *blocks)
        declares(owner, *blocks.map { it to owner }.toTypedArray())
    }

    private fun startable(owner: CaseDefinitionId, vararg blocks: BuildingBlockDefinitionId) {
        whenever(linkRepository.findAllByCaseDefinitionId(owner))
            .thenReturn(blocks.map { CaseDefinitionBuildingBlockLink(caseDefinitionId = owner, buildingBlockDefinitionId = it) })
    }
}
