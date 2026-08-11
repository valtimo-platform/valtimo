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

import com.ritense.case_.domain.migration.CaseDefinitionMigration
import com.ritense.case_.repository.CaseDefinitionMigrationRepository
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.blueprint.migration.BlueprintMigrationId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.semver4j.Semver

class BuildingBlockMigrationPathResolverTest {

    private lateinit var migrationRepository: CaseDefinitionMigrationRepository
    private lateinit var resolver: BuildingBlockMigrationPathResolver

    /** Every plan of the fake deployment, so the stub can answer "what leaves this version?". */
    private val plans = mutableListOf<CaseDefinitionMigration>()

    @BeforeEach
    fun setUp() {
        migrationRepository = mock()
        resolver = BuildingBlockMigrationPathResolver(migrationRepository)
        whenever(
            migrationRepository.findAllByIdBlueprintTypeAndSourceKeyAndSourceVersionTag(
                eq(BlueprintType.BUILDING_BLOCK), any(), any()
            )
        ).thenAnswer { invocation ->
            val key = invocation.getArgument<String>(1)
            val version = invocation.getArgument<Semver>(2)
            plans.filter { it.sourceKey == key && it.sourceVersionTag == version }
        }
    }

    @Test
    fun `should resolve a single hop`() {
        plan("controle", from = block("1.0.0"), to = block("1.0.1"))

        assertThat(resolver.resolvePath(block("1.0.0"), block("1.0.1")))
            .containsExactly(step("controle", block("1.0.1")))
    }

    @Test
    fun `should resolve every plan in between when the owner links several versions ahead`() {
        plan("two", from = block("1.0.0"), to = block("2.0.0"))
        plan("three", from = block("2.0.0"), to = block("3.0.0"))

        assertThat(resolver.resolvePath(block("1.0.0"), block("3.0.0")))
            .containsExactly(step("two", block("2.0.0")), step("three", block("3.0.0")))
    }

    @Test
    fun `should resolve a single plan that declares the whole jump`() {
        // The point of an explicit source: one plan may cover what used to need a plan per version.
        plan("sprong", from = block("1.0.0"), to = block("3.0.0"))

        assertThat(resolver.resolvePath(block("1.0.0"), block("3.0.0")))
            .containsExactly(step("sprong", block("3.0.0")))
    }

    @Test
    fun `should resolve a plan that leads to a different building block key`() {
        plan("dossier", from = block("1.0.1"), to = otherBlock("1.0.0"))

        assertThat(resolver.resolvePath(block("1.0.1"), otherBlock("1.0.0")))
            .containsExactly(step("dossier", otherBlock("1.0.0")))
    }

    @Test
    fun `should resolve a chain that crosses keys halfway`() {
        plan("two", from = block("1.0.0"), to = block("1.0.1"))
        plan("dossier", from = block("1.0.1"), to = otherBlock("1.0.0"))

        assertThat(resolver.resolvePath(block("1.0.0"), otherBlock("1.0.0")))
            .containsExactly(step("two", block("1.0.1")), step("dossier", otherBlock("1.0.0")))
    }

    @Test
    fun `should resolve nothing when the instance is already on the linked version`() {
        assertThat(resolver.resolvePath(block("2.0.0"), block("2.0.0"))).isEmpty()
    }

    @Test
    fun `should fail when no plan connects the two versions`() {
        plan("controle", from = block("1.0.0"), to = block("1.0.1"))

        assertThatThrownBy { resolver.resolvePath(block("1.0.0"), block("3.0.0")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("No migration plan connects building block version")
    }

    @Test
    fun `should fail when a step of the chain has no plan, rather than bridging it`() {
        // 1.0.0 -> 1.0.1 exists and 1.0.2 -> 1.0.3 exists, but nothing covers 1.0.1 -> 1.0.2.
        plan("one", from = block("1.0.0"), to = block("1.0.1"))
        plan("three", from = block("1.0.2"), to = block("1.0.3"))

        assertThatThrownBy { resolver.resolvePath(block("1.0.0"), block("1.0.3")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("No migration plan connects building block version")
    }

    @Test
    fun `should fail when more than one chain of plans leads to the linked version`() {
        // Both a one-plan jump and a two-plan chain reach 1.0.2 — which transformations run would be a
        // coin toss, so neither is chosen.
        plan("sprong", from = block("1.0.0"), to = block("1.0.2"))
        plan("een", from = block("1.0.0"), to = block("1.0.1"))
        plan("twee", from = block("1.0.1"), to = block("1.0.2"))

        assertThatThrownBy { resolver.resolvePath(block("1.0.0"), block("1.0.2")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("more than one chain of migration plans")
            .hasMessageContaining("sprong")
            .hasMessageContaining("een -> twee")
    }

    @Test
    fun `should fail when two plans declare the same source and target`() {
        // One edge per plan: two plans over the same pair of versions are two chains, not one chain of
        // two steps. This replaces the old "apply all plans on a version in key order" behaviour.
        plan("een", from = block("1.0.0"), to = block("1.0.1"))
        plan("twee", from = block("1.0.0"), to = block("1.0.1"))

        assertThatThrownBy { resolver.resolvePath(block("1.0.0"), block("1.0.1")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("more than one chain of migration plans")
    }

    @Test
    fun `should terminate on a cycle in the plan graph instead of looping`() {
        plan("heen", from = block("1.0.0"), to = block("1.0.1"))
        plan("terug", from = block("1.0.1"), to = block("1.0.0"))

        assertThatThrownBy { resolver.resolvePath(block("1.0.0"), block("9.0.0")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("No migration plan connects building block version")
    }

    @Test
    fun `isReachable should be true for a version the plans lead to, over any number of steps`() {
        plan("two", from = block("1.0.0"), to = block("2.0.0"))
        plan("three", from = block("2.0.0"), to = otherBlock("1.0.0"))

        assertThat(resolver.isReachable(block("1.0.0"), otherBlock("1.0.0"))).isTrue()
        assertThat(resolver.isReachable(block("1.0.0"), block("2.0.0"))).isTrue()
    }

    @Test
    fun `isReachable should be true for the version the instance is already on`() {
        assertThat(resolver.isReachable(block("1.0.0"), block("1.0.0"))).isTrue()
    }

    @Test
    fun `isReachable should be false when no plan leads there, and should not care about ambiguity`() {
        plan("een", from = block("1.0.0"), to = block("1.0.1"))
        plan("twee", from = block("1.0.0"), to = block("1.0.1"))

        assertThat(resolver.isReachable(block("1.0.0"), block("9.9.9"))).isFalse()
        // Two chains lead to 1.0.1; reachability is still a plain yes — only resolvePath refuses.
        assertThat(resolver.isReachable(block("1.0.0"), block("1.0.1"))).isTrue()
    }

    private fun block(version: String) = BuildingBlockDefinitionId(KEY, version)

    private fun otherBlock(version: String) = BuildingBlockDefinitionId(OTHER_KEY, version)

    private fun step(migrationKey: String, target: BuildingBlockDefinitionId) =
        BuildingBlockMigrationPathResolver.MigrationStep(
            BlueprintMigrationId.from(target, migrationKey),
            target,
        )

    /** Deploy a plan on [to] that migrates instances of [from] — one edge of the plan graph. */
    private fun plan(migrationKey: String, from: BuildingBlockDefinitionId, to: BuildingBlockDefinitionId) {
        plans += CaseDefinitionMigration(
            id = BlueprintMigrationId.from(to, migrationKey),
            sourceKey = from.key,
            sourceVersionTag = from.versionTag,
            title = migrationKey,
        )
    }

    private companion object {
        const val KEY = "inspectie-fotos"
        const val OTHER_KEY = "inspectie-dossier"
    }
}
