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

import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class CallActivityBuildingBlockEntryOwnershipTest {

    private lateinit var linkResolver: LinkedBuildingBlockVersionResolver
    private lateinit var ownership: CallActivityBuildingBlockEntryOwnership

    private val target = CaseDefinitionId("verhuizing", "1.0.2")
    private val source = CaseDefinitionId("verhuizing", "1.0.1")
    private val block = BuildingBlockDefinitionId.of("inspectie-fotos", "1.0.1")

    @BeforeEach
    fun setUp() {
        linkResolver = mock()
        ownership = CallActivityBuildingBlockEntryOwnership(linkResolver)
    }

    @Test
    fun `should answer the migrating owner for a block it declares itself`() {
        declares(target, block to target)

        assertThat(ownership.entryOwnerOf(target, block)).isEqualTo(target)
    }

    @Test
    fun `should answer the parent block for a nested one`() {
        val parent = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.4")
        declares(target, block to parent)

        assertThat(ownership.entryOwnerOf(target, block)).isEqualTo(parent)
    }

    @Test
    fun `should read a parent block back at the version the other tree declares`() {
        // What the running instances are on: an add entry's owner is read off the target, which they have not reached.
        val onTarget = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.4")
        val onSource = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.3")
        reaches(source, onSource)

        assertThat(ownership.ownerAsDeclaredIn(source, onTarget)).isEqualTo(onSource)
    }

    @Test
    fun `should keep the owner when the other tree declares no version of it`() {
        reaches(source, BuildingBlockDefinitionId.of("income-check", "1.0.0"))

        assertThat(ownership.ownerAsDeclaredIn(source, block)).isEqualTo(block)
    }

    @Test
    fun `should keep the owner when the other tree declares two versions of its key`() {
        // Which of them the instances are on cannot be told from here, and taking whichever the set yielded
        // first made the answer depend on iteration order. Fall back to the version asked about.
        val onTarget = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.4")
        reaches(
            source,
            BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.2"),
            BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.3"),
        )

        assertThat(ownership.ownerAsDeclaredIn(source, onTarget)).isEqualTo(onTarget)
    }

    @Test
    fun `should still answer exactly when the tree declares the very version asked about`() {
        // An exact match is never ambiguous, however many other versions of the key are declared beside it.
        val onSource = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.3")
        reaches(source, BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.2"), onSource)

        assertThat(ownership.ownerAsDeclaredIn(source, onSource)).isEqualTo(onSource)
    }

    @Test
    fun `should keep the migrating owner when two declared versions of a key could own the entry`() {
        val first = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.3")
        val second = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.4")
        declares(
            target,
            BuildingBlockDefinitionId.of("inspectie-fotos", "1.0.0") to first,
            BuildingBlockDefinitionId.of("inspectie-fotos", "1.0.2") to second,
        )

        assertThat(ownership.entryOwnerOf(target, block)).isEqualTo(target)
    }

    @Test
    fun `should still answer exactly when the declarers hold the very block version asked about`() {
        val parent = BuildingBlockDefinitionId.of("verhuizing-inspectie", "1.0.4")
        declares(
            target,
            BuildingBlockDefinitionId.of("inspectie-fotos", "1.0.0") to target,
            block to parent,
        )

        assertThat(ownership.entryOwnerOf(target, block)).isEqualTo(parent)
    }

    @Test
    fun `should leave a case owner alone, since the plan already names the version it migrates from`() {
        assertThat(ownership.ownerAsDeclaredIn(source, target)).isEqualTo(target)
    }

    private fun declares(tree: BlueprintId, vararg declarers: Pair<BuildingBlockDefinitionId, BlueprintId>) {
        whenever(linkResolver.resolveCallActivityDeclarers(tree)).thenReturn(declarers.toMap())
    }

    private fun reaches(tree: BlueprintId, vararg blocks: BuildingBlockDefinitionId) {
        whenever(linkResolver.resolveCallActivityReachable(tree)).thenReturn(blocks.toSet())
    }
}
