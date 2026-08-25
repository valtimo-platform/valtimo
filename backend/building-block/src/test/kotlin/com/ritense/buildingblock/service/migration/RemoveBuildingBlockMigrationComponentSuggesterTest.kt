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
import com.ritense.buildingblock.domain.migration.RemoveBuildingBlockInstruction
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

/**
 * The dissolve suggestion has to cover the **whole** subtree the owner stops modelling, because the
 * executor dissolves only what an entry names and a block left below a dissolved parent is orphaned (G25).
 * It also has to aim each entry at the owner that block really hands back to.
 */
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
        whenever(dataSuggester.suggestForBuildingBlockEntry(any(), any())).thenReturn(null)
        whenever(processSuggester.suggestForBuildingBlockEntry(any(), any())).thenReturn(null)
        suggester = RemoveBuildingBlockMigrationComponentSuggester(
            ObjectMapper(), caseLinkRepository, linkResolver, dataSuggester, processSuggester,
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

        val suggestion = suggester.suggest(source, target) as List<RemoveBuildingBlockInstruction>

        assertThat(suggestion.map { it.buildingBlockKey })
            .containsExactlyInAnyOrder("bijstand-uitvoeren", "bijstand-besluit")
        assertThat(suggestion.map { it.buildingBlockVersionTag }).containsOnly("1.0.0")
    }

    @Test
    fun `should compute a nested entry's mapping against its parent block, not the migrating case`() {
        declares(source, uitvoeren to source, besluit to uitvoeren)

        suggester.suggest(source, target)

        // The nested block hands back one level, to uitvoeren.
        verify(dataSuggester).suggestForBuildingBlockEntry(eq(besluit), eq(uitvoeren))
        verify(processSuggester).suggestForBuildingBlockEntry(eq(besluit), eq(uitvoeren))
        // The first-level block hands back to the owner on the version it ends up on.
        verify(dataSuggester).suggestForBuildingBlockEntry(eq(uitvoeren), eq(target))
    }

    @Test
    fun `should not suggest removing a block the target still models`() {
        declares(source, uitvoeren to source, besluit to uitvoeren)
        declares(target, uitvoeren to target)

        val suggestion = suggester.suggest(source, target) as List<RemoveBuildingBlockInstruction>

        assertThat(suggestion.map { it.buildingBlockKey }).containsExactly("bijstand-besluit")
    }

    @Test
    fun `should suggest removing a block the owner only offered as a startable item`() {
        // Stubbed before it is handed to another stub: Mockito treats a nested `whenever` inside a
        // `thenReturn` argument as an unfinished stubbing and fails the test.
        val startableLink = mock<CaseDefinitionBuildingBlockLink>()
        whenever(startableLink.buildingBlockDefinitionId).thenReturn(besluit)
        whenever(caseLinkRepository.findAllByCaseDefinitionId(source)).thenReturn(listOf(startableLink))

        val suggestion = suggester.suggest(source, target) as List<RemoveBuildingBlockInstruction>

        assertThat(suggestion.map { it.buildingBlockKey }).containsExactly("bijstand-besluit")
    }

    @Test
    fun `should suggest nothing when the owner loses no blocks`() {
        declares(source, uitvoeren to source)
        declares(target, uitvoeren to target)

        assertThat(suggester.suggest(source, target)).isNull()
    }

    private fun declares(owner: BlueprintId, vararg edges: Pair<BuildingBlockDefinitionId, BlueprintId>) {
        whenever(linkResolver.resolveCallActivityDeclarers(owner)).thenReturn(edges.toMap())
    }
}
