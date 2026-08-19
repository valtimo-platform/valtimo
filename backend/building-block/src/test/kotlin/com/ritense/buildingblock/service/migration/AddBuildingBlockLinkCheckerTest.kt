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

import com.ritense.buildingblock.domain.migration.AddBuildingBlockInstruction
import com.ritense.buildingblock.service.migration.LinkedBuildingBlockVersionResolver.LinkOrigin
import com.ritense.buildingblock.service.migration.LinkedBuildingBlockVersionResolver.LinkedBuildingBlock
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

class AddBuildingBlockLinkCheckerTest {

    private lateinit var linkResolver: LinkedBuildingBlockVersionResolver
    private lateinit var checker: AddBuildingBlockLinkChecker

    private val target = CaseDefinitionId("verhuizing", "1.0.1")

    @BeforeEach
    fun setUp() {
        linkResolver = mock()
        checker = AddBuildingBlockLinkChecker(linkResolver)
    }

    @Test
    fun `should accept an entry whose building block version the target links`() {
        linksOn(target, startableItem("income-check", "1.0.0"))

        assertThat(checker.findUnlinked(target, listOf(adds("income-check", "1.0.0")))).isEmpty()
    }

    @Test
    fun `should accept an entry linked through a call activity`() {
        linksOn(target, callActivity("income-check", "1.0.0", "CallIncomeCheck"))

        assertThat(checker.findUnlinked(target, listOf(adds("income-check", "1.0.0")))).isEmpty()
    }

    @Test
    fun `should accept an entry for a nested block the target reaches through another block`() {
        // The `bijstand` shape: the case links `uitvoeren`, and only `uitvoeren` links `besluit`. An entry
        // for the nested one is what authorises adoption to descend into it, so it must not be refused.
        linksOn(target, callActivity("bijstand-uitvoeren", "1.0.0", "UitvoerenCallActivity"))
        reachableFrom(
            target,
            BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0"),
            BuildingBlockDefinitionId.of("bijstand-besluit", "1.0.0"),
        )

        val problems = checker.findUnlinked(
            target,
            listOf(adds("bijstand-uitvoeren", "1.0.0"), adds("bijstand-besluit", "1.0.0")),
        )

        assertThat(problems).isEmpty()
    }

    @Test
    fun `should still refuse a nested entry at a version nothing below the target links`() {
        linksOn(target, callActivity("bijstand-uitvoeren", "1.0.0", "UitvoerenCallActivity"))
        reachableFrom(
            target,
            BuildingBlockDefinitionId.of("bijstand-uitvoeren", "1.0.0"),
            BuildingBlockDefinitionId.of("bijstand-besluit", "1.0.0"),
        )

        val problems = checker.findUnlinked(target, listOf(adds("bijstand-besluit", "2.0.0")))

        assertThat(problems).singleElement().asString()
            .contains("adds building block 'bijstand-besluit:2.0.0', which is never used")
            .contains("links 'bijstand-besluit:1.0.0' instead")
    }

    @Test
    fun `should refuse an entry whose building block the target links nowhere`() {
        linksOn(target, startableItem("verhuizing-inspectie", "1.0.0"))

        val problems = checker.findUnlinked(target, listOf(adds("income-check", "1.0.0")))

        assertThat(problems).singleElement().asString()
            .contains("adds building block 'income-check:1.0.0', which is never used")
            .contains("links no version of 'income-check' at all")
    }

    @Test
    fun `should refuse an entry the target links at another version`() {
        linksOn(target, startableItem("income-check", "1.0.1"))

        val problems = checker.findUnlinked(target, listOf(adds("income-check", "1.0.0")))

        assertThat(problems).singleElement().asString()
            .contains("adds building block 'income-check:1.0.0', which is never used")
            .contains("links 'income-check:1.0.1' instead")
    }

    @Test
    fun `should report every offending entry`() {
        linksOn(target, startableItem("case-notification", "1.0.0"))

        val problems = checker.findUnlinked(
            target,
            listOf(
                adds("case-notification", "1.0.0"),
                adds("inspectie-dossier", "1.0.0"),
                adds("case-review", "1.0.0"),
            ),
        )

        assertThat(problems).hasSize(2)
        assertThat(problems.joinToString()).contains("inspectie-dossier:1.0.0", "case-review:1.0.0")
    }

    @Test
    fun `should not resolve links for a plan without an addBuildingBlock component`() {
        assertThat(checker.findUnlinked(target, emptyList())).isEmpty()

        verify(linkResolver, never()).resolveLinkedVersions(any())
    }

    @Test
    fun `should throw when asserting an unlinked entry`() {
        linksOn(target)

        assertThatThrownBy { checker.assertLinked(target, listOf(adds("income-check", "1.0.0"))) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("income-check:1.0.0")
            .hasMessageContaining("never used")
    }

    @Test
    fun `should not throw when asserting a linked entry`() {
        linksOn(target, startableItem("income-check", "1.0.0"))

        checker.assertLinked(target, listOf(adds("income-check", "1.0.0")))
    }

    private fun adds(key: String, versionTag: String) = AddBuildingBlockInstruction(key, versionTag)

    private fun startableItem(key: String, versionTag: String) =
        LinkedBuildingBlock(BuildingBlockDefinitionId.of(key, versionTag), LinkOrigin.STARTABLE_ITEM)

    private fun callActivity(key: String, versionTag: String, activityId: String) =
        LinkedBuildingBlock(BuildingBlockDefinitionId.of(key, versionTag), LinkOrigin.CALL_ACTIVITY, activityId)

    private fun linksOn(owner: CaseDefinitionId, vararg links: LinkedBuildingBlock) {
        whenever(linkResolver.resolveLinkedVersions(owner)).thenReturn(links.toList())
    }

    private fun reachableFrom(owner: CaseDefinitionId, vararg blocks: BuildingBlockDefinitionId) {
        whenever(linkResolver.resolveCallActivityReachable(owner)).thenReturn(blocks.toSet())
    }
}
