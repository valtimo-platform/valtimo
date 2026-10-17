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

package com.ritense.buildingblock.service.referenceupdate

import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.BUILDING_BLOCK
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.CASE
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.semver4j.Semver
import java.util.UUID

class BuildingBlockReferenceIndexTest {

    private val source = BuildingBlockDefinitionId.of("send-email", "1.0.0")
    private val target = BuildingBlockDefinitionId.of("send-email", "1.0.1")
    private val original = ReferenceContainer(BUILDING_BLOCK, "notify", Semver("1.0.0"))
    private val draft = ReferenceContainer(BUILDING_BLOCK, "notify", Semver("1.1.0"))
    private val location = ProcessLinkLocation("notify-process", "call-send-email")
    private val reference = reference(original, location, source)

    @Test
    fun `findCorresponding returns the link at the same location to the same child`() {
        val exact = reference(draft, location, source)
        val index = index(reference(draft, location, target), exact)

        assertThat(index.findCorresponding(draft, reference, setOf(target))).isEqualTo(exact)
    }

    @Test
    fun `findCorresponding falls back to a link to an accepted version`() {
        val accepted = reference(draft, location, target)
        val index = index(accepted)

        assertThat(index.findCorresponding(draft, reference, setOf(target))).isEqualTo(accepted)
        assertThat(index.findCorresponding(draft, reference, emptySet())).isNull()
    }

    @Test
    fun `findCorresponding follows a case link to the accepted version of another key`() {
        val case = ReferenceContainer(CASE, "moving", Semver("1.0.0"))
        val caseDraft = ReferenceContainer(CASE, "moving", Semver("1.1.0"))
        val letter = BuildingBlockDefinitionId.of("send-letter", "1.0.0")
        val accepted = reference(caseDraft, CaseLinkLocation(letter.key), letter)
        val index = index(accepted)

        assertThat(index.findCorresponding(caseDraft, reference(case, CaseLinkLocation(source.key), source), setOf(letter)))
            .isEqualTo(accepted)
    }

    @Test
    fun `findCorresponding is null when several links match an accepted version`() {
        val other = BuildingBlockDefinitionId.of("send-email", "1.0.2")
        val index = index(reference(draft, location, target), reference(draft, location, other))

        assertThat(index.findCorresponding(draft, reference, setOf(target, other))).isNull()
    }

    @Test
    fun `findCorresponding is null without a link at the location`() {
        val index = index(
            reference(draft, ProcessLinkLocation("notify-process", "other-activity"), source),
            reference(draft, location, BuildingBlockDefinitionId.of("send-email", "0.9.0")),
        )

        assertThat(index.findCorresponding(draft, reference, setOf(target))).isNull()
    }

    @Test
    fun `newestOpenDraft orders by semver, not insertion order, and skips final versions`() {
        fun newest(vararg versions: Pair<String, Boolean>): String? {
            val containers = versions.map { (version, final) ->
                ReferenceContainerInfo(original.withVersion(Semver(version)), final, null, "Notify")
            }
            return BuildingBlockReferenceIndex(emptyList(), containers).newestOpenDraft(original)?.container?.versionTag?.toString()
        }

        assertThat(newest("1.10.0" to false, "1.9.0" to false)).isEqualTo("1.10.0")
        assertThat(newest("1.9.0" to false, "1.10.0" to false)).isEqualTo("1.10.0")
        assertThat(newest("1.10.0" to false, "1.2.0" to false)).isEqualTo("1.10.0")
        assertThat(newest("1.2.0" to false, "1.10.0" to false)).isEqualTo("1.10.0")
        assertThat(newest("1.2.0" to false, "2.0.0" to true)).isEqualTo("1.2.0")
        assertThat(newest("1.0.0" to true)).isNull()
    }

    @Test
    fun `newestOpenDraft ignores other keys and types`() {
        val index = BuildingBlockReferenceIndex(
            emptyList(),
            listOf(
                ReferenceContainerInfo(ReferenceContainer(BUILDING_BLOCK, "other", Semver("9.0.0")), false, null, null),
                ReferenceContainerInfo(ReferenceContainer(CASE, "notify", Semver("9.0.0")), false, null, null),
            ),
        )

        assertThat(index.newestOpenDraft(original)).isNull()
    }

    @Test
    fun `unknown containers count as final`() {
        assertThat(BuildingBlockReferenceIndex(emptyList(), emptyList()).isFinal(original)).isTrue()
    }

    private fun index(vararg references: IndexedReference) = BuildingBlockReferenceIndex(references.toList(), emptyList())

    private fun reference(container: ReferenceContainer, location: ReferenceLocation, child: BuildingBlockDefinitionId) = IndexedReference(
        container = container,
        location = location,
        child = child,
        linkId = UUID.randomUUID(),
        processDefinitionId = null,
        inputMappings = emptyList(),
        outputMappings = emptyList(),
        pluginConfigurationMappings = emptyMap(),
    )
}
