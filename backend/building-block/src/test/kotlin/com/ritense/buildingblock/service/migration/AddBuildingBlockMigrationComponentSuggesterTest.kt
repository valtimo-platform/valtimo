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
import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.case_.service.migration.DataMigrationComponentSuggester
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

/**
 * The suggestion has to carry the whole subtree and no `processMigration`, because that is precisely the
 * shape adoption needs and `AddBuildingBlockProcessChecker` accepts. A suggestion of any other shape
 * would pre-fill a plan that its own checkers refuse.
 */
class AddBuildingBlockMigrationComponentSuggesterTest {

    private lateinit var linkResolver: LinkedBuildingBlockVersionResolver
    private lateinit var dataSuggester: DataMigrationComponentSuggester
    private lateinit var suggester: AddBuildingBlockMigrationComponentSuggester

    private val source = CaseDefinitionId("bijstand", "1.0.0")
    private val target = CaseDefinitionId("bijstand", "1.0.1")

    private val uitvoeren = BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0")
    private val besluit = BuildingBlockDefinitionId.of("bijstand-besluit", "1.0.0")

    @BeforeEach
    fun setUp() {
        linkResolver = mock()
        dataSuggester = mock()
        whenever(dataSuggester.suggest(any(), any())).thenReturn(null)
        whenever(linkResolver.resolveCallActivityReachable(any())).thenReturn(emptySet())
        suggester = AddBuildingBlockMigrationComponentSuggester(ObjectMapper(), linkResolver, dataSuggester)
    }

    @Test
    fun `should report the plan component key it fills`() {
        assertThat(suggester.componentKey()).isEqualTo("addBuildingBlock")
    }

    @Test
    fun `should suggest an entry per newly declared block, nested ones included, with no processMigration`() {
        whenever(linkResolver.resolveCallActivityReachable(target)).thenReturn(setOf(uitvoeren, besluit))

        val suggestion = suggester.suggest(source, target) as List<AddBuildingBlockInstruction>

        assertThat(suggestion).hasSize(2)
        assertThat(suggestion.map { it.buildingBlockKey })
            .containsExactly("bijstand-besluit", "bijstand-uitvoeren")
        assertThat(suggestion.map { it.buildingBlockVersionTag }).containsOnly("1.0.0")
        // Adoption locates the process from the link; naming a key would only repeat it.
        assertThat(suggestion).allSatisfy({ assertThat(it.processMigration).isEmpty() })
    }

    @Test
    fun `should not suggest a block the source already declared`() {
        whenever(linkResolver.resolveCallActivityReachable(source)).thenReturn(setOf(uitvoeren))
        whenever(linkResolver.resolveCallActivityReachable(target)).thenReturn(setOf(uitvoeren, besluit))

        val suggestion = suggester.suggest(source, target) as List<AddBuildingBlockInstruction>

        assertThat(suggestion.map { it.buildingBlockKey }).containsExactly("bijstand-besluit")
    }

    @Test
    fun `should suggest nothing when the target declares no new blocks`() {
        whenever(linkResolver.resolveCallActivityReachable(source)).thenReturn(setOf(uitvoeren))
        whenever(linkResolver.resolveCallActivityReachable(target)).thenReturn(setOf(uitvoeren))

        assertThat(suggester.suggest(source, target)).isNull()
    }
}
