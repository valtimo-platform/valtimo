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

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.buildingblock.repository.BuildingBlockDefinitionRepository
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.semver4j.Semver
import java.util.Optional

class BuildingBlockMigrationPathResolverTest {

    private lateinit var definitionRepository: BuildingBlockDefinitionRepository
    private lateinit var resolver: BuildingBlockMigrationPathResolver

    private val key = "verhuizing-inspectie"

    @BeforeEach
    fun setUp() {
        definitionRepository = mock()
        resolver = BuildingBlockMigrationPathResolver(definitionRepository)
    }

    @Test
    fun `should resolve a single hop`() {
        chain("1.0.0" to null, "1.0.1" to "1.0.0")

        assertThat(resolver.resolvePath(key, Semver("1.0.0"), Semver("1.0.1")))
            .containsExactly(Semver("1.0.1"))
    }

    @Test
    fun `should resolve every version in between when the link skips versions`() {
        chain("1.0.0" to null, "2.0.0" to "1.0.0", "3.0.0" to "2.0.0")

        assertThat(resolver.resolvePath(key, Semver("1.0.0"), Semver("3.0.0")))
            .containsExactly(Semver("2.0.0"), Semver("3.0.0"))
    }

    @Test
    fun `should resolve nothing when the instance is already on the linked version`() {
        assertThat(resolver.resolvePath(key, Semver("2.0.0"), Semver("2.0.0"))).isEmpty()
    }

    @Test
    fun `should resolve nothing when the linked version is older than the instance`() {
        assertThat(resolver.resolvePath(key, Semver("3.0.0"), Semver("2.0.0"))).isEmpty()
    }

    @Test
    fun `should fail when a version in the chain is not based on a previous version`() {
        // 3.0.0 was created standalone rather than as a new version of 2.0.0, so 1.0.0 cannot reach it.
        chain("1.0.0" to null, "3.0.0" to null)

        assertThatThrownBy { resolver.resolvePath(key, Semver("1.0.0"), Semver("3.0.0")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("no upgrade path")
    }

    @Test
    fun `should fail when a version in the chain is not deployed`() {
        chain("3.0.0" to "2.0.0") // 2.0.0 itself is missing

        assertThatThrownBy { resolver.resolvePath(key, Semver("1.0.0"), Semver("3.0.0")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("no definition deployed for version '2.0.0'")
    }

    @Test
    fun `should fail when the chain loops instead of reaching the current version`() {
        chain("2.0.0" to "3.0.0", "3.0.0" to "2.0.0")

        assertThatThrownBy { resolver.resolvePath(key, Semver("1.0.0"), Semver("3.0.0")) }
            .isInstanceOf(IllegalStateException::class.java)
            .hasMessageContaining("loops at")
    }

    /** Register definitions as `version to basedOnVersion` pairs. */
    private fun chain(vararg versions: Pair<String, String?>) {
        versions.forEach { (version, basedOn) ->
            val id = BuildingBlockDefinitionId.of(key, version)
            whenever(definitionRepository.findById(id)).thenReturn(
                Optional.of(
                    BuildingBlockDefinition(
                        id = id,
                        name = key,
                        basedOnVersionTag = basedOn?.let { Semver(it) },
                    )
                )
            )
        }
    }
}
