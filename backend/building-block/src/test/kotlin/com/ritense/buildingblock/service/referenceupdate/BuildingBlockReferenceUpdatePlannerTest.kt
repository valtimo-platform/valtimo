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

import com.ritense.buildingblock.exception.BuildingBlockReferenceUpdateException
import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.dto.BuildingBlockFieldDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.BUILDING_BLOCK
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.CASE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.CYCLE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.DRAFTS_NOT_ALLOWED
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.DRAFT_MISSING_REFERENCE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateReasonCode.SELF_REFERENCE
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.semver4j.Semver
import java.util.UUID

class BuildingBlockReferenceUpdatePlannerTest {

    @Test
    fun `a new draft version bumps the key's latest version by the component that differs between source and target, or major for another key`() {
        val notify = { version: String -> ReferenceContainer(BUILDING_BLOCK, "notify", Semver(version)) }
        val versions = BuildingBlockReferenceIndex(
            references = emptyList(),
            containers = listOf("1.1.0", "1.2.0").map { ReferenceContainerInfo(notify(it), true, null, "Notify") },
        )

        fun allocate(sourceVersion: String, targetVersion: String, targetKey: String = "send-email") = BuildingBlockReferenceUpdatePlanner(
            versions,
            BuildingBlockDefinitionId.of("send-email", sourceVersion),
            BuildingBlockDefinitionId.of(targetKey, targetVersion),
            TargetFields(emptyList()),
            emptySet(),
            true,
        ).allocateDraftVersions(listOf(notify("1.1.0"))).getValue(notify("1.1.0")).toString()

        assertThat(allocate("1.0.0", "1.0.1")).isEqualTo("1.2.1")
        assertThat(allocate("1.0.1", "1.0.0")).isEqualTo("1.2.1")
        assertThat(allocate("1.0.0", "1.1.0")).isEqualTo("1.3.0")
        assertThat(allocate("1.0.0", "2.0.0")).isEqualTo("2.0.0")
        assertThat(allocate("1.0.0", "1.0.1", targetKey = "send-letter")).isEqualTo("2.0.0")
    }

    @Test
    fun `a chain through a building block that calls another version of its own key is not updatable`() {
        val a = block("a", "1.0.0")
        val b100 = block("b", "1.0.0")
        val b101 = block("b", "1.0.1")
        val y = ReferenceContainer(CASE, "y", Semver("1.0.0"))
        val index = index(reference(b101, a), reference(y, b101.id()))

        val planner = planner(index, a.id(), b100.id())
        val analyses = planner.findChains().map { planner.analyze(it) }

        assertThat(analyses).hasSize(1).allSatisfy { analysis ->
            assertThat(analysis.notUpdatableReasons.map { it.code }).containsExactly(SELF_REFERENCE)
            assertThat(analysis.selectedByDefault).isFalse()
        }
    }

    @Test
    fun `building blocks referencing each other give a cycle chain`() {
        val a = block("a", "1.0.0")
        val b = block("b", "1.0.0")
        val index = index(reference(b, a), reference(a, b.id()))

        val planner = planner(index, a.id(), BuildingBlockDefinitionId.of("a", "1.0.1"))
        val chain = planner.findChains().single()

        assertThat(chain.cycle).isTrue()
        assertThat(planner.analyze(chain).notUpdatableReasons.map { it.code }).contains(CYCLE)
    }

    @Test
    fun `too many chains are refused instead of walked`() {
        // Each layer doubles the paths: 2^10 chains
        val layers = (0..10).map { layer -> listOf(block("l$layer-x", "1.0.0"), block("l$layer-y", "1.0.0")) }
        val source = block("source", "1.0.0")
        val references = layers.first().map { reference(it, source) } +
            layers.zipWithNext().flatMap { (lower, upper) ->
                upper.flatMap { parent -> lower.map { child -> reference(parent, child.id()) } }
            }

        val planner = planner(index(*references.toTypedArray()), source.id(), BuildingBlockDefinitionId.of("source", "1.0.1"))

        assertThatThrownBy { planner.findChains() }
            .isInstanceOf(BuildingBlockReferenceUpdateException::class.java)
            .hasMessageContaining("More than ${BuildingBlockReferenceUpdatePlanner.MAX_CHAINS} reference paths")
    }

    @Test
    fun `diamond graphs and multiple parents give one chain per path`() {
        val chains = planner(indexOf(diamond()), s.id(), target).findChains()

        assertThat(chains.map { it.containers }).containsExactlyInAnyOrder(
            listOf(b, d, x),
            listOf(c, d, x),
            listOf(b, y),
        )
        assertThat(chains.map { it.id }).doesNotHaveDuplicates()
    }

    @Test
    fun `chain ids and order are stable across runs and independent of input ordering`() {
        fun ids(references: List<IndexedReference>) = planner(indexOf(references), s.id(), target).findChains().map { it.id }

        val first = ids(diamond())

        assertThat(ids(diamond())).isEqualTo(first)
        assertThat(ids(diamond().reversed())).isEqualTo(first)
        assertThat(ids(diamond().shuffled(java.util.Random(42)))).isEqualTo(first)
    }

    @Test
    fun `an in-place draft stops the walk up`() {
        val chain = listOf(reference(b, s), reference(d, b), reference(x, d))
        val planner = planner(indexOf(chain), s.id(), target)

        val analysis = planner.analyze(planner.findChains().single())

        assertThat(analysis.repointedHops).containsExactlyEntriesOf(mapOf(0 to InPlaceDraft(b)))
        assertThat(analysis.requiresDrafts).isFalse()
        assertThat(analysis.selectedByDefault).isTrue()
    }

    @Test
    fun `a final container without open draft gets a new draft and the walk continues`() {
        val chain = listOf(reference(b, s), reference(d, b), reference(x, d))
        val planner = planner(indexOf(chain, final = setOf(b)), s.id(), target)

        val analysis = planner.analyze(planner.findChains().single())

        assertThat(analysis.repointedHops).containsExactlyEntriesOf(mapOf(0 to NewDraft(b), 1 to InPlaceDraft(d)))
        assertThat(analysis.requiresDrafts).isTrue()
        assertThat(analysis.selectedByDefault).isFalse()
    }

    @Test
    fun `an existing draft without the link is not updatable`() {
        val b110 = block("b", "1.1.0")
        val planner = planner(indexOf(listOf(reference(b, s), reference(x, b)), final = setOf(b), extra = listOf(b110)), s.id(), target)

        val analysis = planner.analyze(planner.findChains().single())

        assertThat(analysis.repointedHops[0]).isEqualTo(ExistingDraft(b, info(b110)))
        assertThat(analysis.effectiveLinks[0]).isNull()
        assertThat(analysis.sourceLink).isNull()
        assertThat(analysis.notUpdatableReasons).containsExactly(
            NotUpdatableReason(
                DRAFT_MISSING_REFERENCE,
                mapOf("draft" to "b 1.1.0", "location" to "b-process#call-s", "buildingBlockKey" to "s"),
            )
        )
    }

    @Test
    fun `an existing draft whose link points at a third version is not updatable`() {
        val b110 = block("b", "1.1.0")
        val references = listOf(reference(b, s), reference(x, b), reference(b110, BuildingBlockDefinitionId.of("s", "0.9.0")))
        val planner = planner(indexOf(references, final = setOf(b)), s.id(), target)

        val analysis = planner.analyze(planner.findChains().single())

        assertThat(analysis.effectiveLinks[0]).isNull()
        assertThat(analysis.notUpdatableReasons.map { it.code }).containsExactly(DRAFT_MISSING_REFERENCE)
    }

    @Test
    fun `an existing draft whose link points at the source or target is used as the effective link`() {
        val b110 = block("b", "1.1.0")
        listOf(s.id(), target).forEach { child ->
            val draftLink = reference(b110, child, inputs = listOf(BuildingBlockInputMapping("draft", "/a")))
            val planner = planner(indexOf(listOf(reference(b, s), reference(x, b), draftLink), final = setOf(b)), s.id(), target)

            // A draft pointing at the source is a chain of its own too
            val analysis = planner.analyze(planner.findChains().single { it.link.container == b })

            assertThat(analysis.notUpdatableReasons).isEmpty()
            assertThat(analysis.effectiveLinks[0]).isEqualTo(draftLink)
            assertThat(analysis.differences.existingInputMappings).isEqualTo(draftLink.inputMappings)
        }
    }

    @Test
    fun `drafts not allowed makes every chain not updatable`() {
        val planner = planner(indexOf(listOf(reference(x, s))), s.id(), target, draftsAllowed = false)

        val analysis = planner.analyze(planner.findChains().single())

        assertThat(analysis.notUpdatableReasons.map { it.code }).containsExactly(DRAFTS_NOT_ALLOWED)
        assertThat(analysis.selectedByDefault).isFalse()
    }

    @Test
    fun `required inputs are covered by kept mappings to the field or a parent field, not by a sibling prefix`() {
        val fields = TargetFields(
            listOf(
                field("/a", true),
                field("/b", true),
                field("/p", true),
                field("/p/c", true),
                field("/pq", true),
                field("/opt", false),
                field("/opt/x", true),
            )
        )
        val link = reference(
            x,
            s.id(),
            inputs = listOf(
                BuildingBlockInputMapping("one", "doc:/a"),
                BuildingBlockInputMapping("two", "/p/"),
                BuildingBlockInputMapping("three", "/gone"),
            ),
        )
        val planner = planner(indexOf(listOf(link)), s.id(), target, fields)

        val analysis = planner.analyze(planner.findChains().single())

        assertThat(analysis.differences.missingRequiredInputs).containsExactly("/b", "/pq")
        assertThat(analysis.unresolvedRequiredInputs(ChainResolution(listOf(BuildingBlockInputMapping("r", "doc:/b/"))), fields))
            .containsExactly("/pq")
    }

    @Test
    fun `mappings to fields the target lacks are dropped`() {
        val fields = TargetFields(listOf(field("/a", false)))
        val keptInput = BuildingBlockInputMapping("one", "doc:/a")
        val droppedInput = BuildingBlockInputMapping("two", "/gone")
        val keptOutput = BuildingBlockOutputMapping("/a", "doc:/x")
        val droppedOutput = BuildingBlockOutputMapping("doc:/gone", "doc:/y")
        val link = reference(x, s.id(), inputs = listOf(keptInput, droppedInput), outputs = listOf(keptOutput, droppedOutput))
        val planner = planner(indexOf(listOf(link)), s.id(), target, fields)

        val differences = planner.analyze(planner.findChains().single()).differences

        assertThat(differences.existingInputMappings).containsExactly(keptInput, droppedInput)
        assertThat(differences.droppedInputMappings).containsExactly(droppedInput)
        assertThat(differences.droppedOutputMappings).containsExactly(droppedOutput)
        assertThat(differences.missingRequiredInputs).isEmpty()
    }

    @Test
    fun `new draft versions skip versions already taken by the key or by earlier allocations`() {
        val notify = { version: String -> block("notify", version) }
        val index = BuildingBlockReferenceIndex(
            references = emptyList(),
            containers = listOf(
                ReferenceContainerInfo(notify("1.1.0"), true, null, "Notify"),
                ReferenceContainerInfo(notify("1.2.0"), true, null, "Notify"),
                ReferenceContainerInfo(notify("1.3.0"), false, null, "Notify"),
            ),
        )

        val allocations = planner(index, s.id(), target)
            .allocateDraftVersions(listOf(notify("1.2.0"), notify("1.1.0"), notify("1.2.0")))

        assertThat(allocations.mapValues { it.value.toString() }).containsExactlyEntriesOf(
            mapOf(notify("1.1.0") to "1.3.1", notify("1.2.0") to "1.3.2")
        )
    }

    private val s = block("s", "1.0.0")
    private val target = BuildingBlockDefinitionId.of("s", "1.0.1")
    private val b = block("b", "1.0.0")
    private val c = block("c", "1.0.0")
    private val d = block("d", "1.0.0")
    private val x = ReferenceContainer(CASE, "x", Semver("1.0.0"))
    private val y = ReferenceContainer(CASE, "y", Semver("1.0.0"))

    /** s <- b, c <- d <- x; b <- y. */
    private fun diamond() = listOf(
        reference(b, s),
        reference(c, s),
        reference(d, b),
        reference(d, c),
        reference(x, d),
        reference(y, b),
    )

    private fun field(name: String, required: Boolean) = BuildingBlockFieldDto(name, required)

    private fun info(container: ReferenceContainer, final: Boolean = false) =
        ReferenceContainerInfo(container, final = final, basedOnVersionTag = null, name = container.key)

    private fun indexOf(
        references: List<IndexedReference>,
        final: Set<ReferenceContainer> = emptySet(),
        extra: List<ReferenceContainer> = emptyList(),
    ): BuildingBlockReferenceIndex {
        val containers = (references.map { it.container } + references.map { ReferenceContainer.of(it.child) } + extra)
            .distinct()
            .map { info(it, final = it in final) }
        return BuildingBlockReferenceIndex(references, containers)
    }

    private fun block(key: String, version: String) = ReferenceContainer(BUILDING_BLOCK, key, Semver(version))

    private fun ReferenceContainer.id() = BuildingBlockDefinitionId(key, versionTag)

    private fun reference(container: ReferenceContainer, child: ReferenceContainer) = reference(container, child.id())

    private fun reference(
        container: ReferenceContainer,
        child: BuildingBlockDefinitionId,
        inputs: List<BuildingBlockInputMapping> = emptyList(),
        outputs: List<BuildingBlockOutputMapping> = emptyList(),
    ) = IndexedReference(
        container = container,
        location = ProcessLinkLocation("${container.key}-process", "call-${child.key}"),
        child = child,
        linkId = UUID.randomUUID(),
        processDefinitionId = "${container.key}:${container.versionTag}",
        inputMappings = inputs,
        outputMappings = outputs,
        pluginConfigurationMappings = emptyMap(),
    )

    private fun index(vararg references: IndexedReference): BuildingBlockReferenceIndex {
        val containers = (references.map { it.container } + references.map { ReferenceContainer.of(it.child) })
            .distinct()
            .map { ReferenceContainerInfo(it, final = false, basedOnVersionTag = null, name = it.key) }
        return BuildingBlockReferenceIndex(references.toList(), containers)
    }

    private fun planner(
        index: BuildingBlockReferenceIndex,
        source: BuildingBlockDefinitionId,
        target: BuildingBlockDefinitionId,
        fields: TargetFields = TargetFields(emptyList()),
        draftsAllowed: Boolean = true,
    ) = BuildingBlockReferenceUpdatePlanner(index, source, target, fields, emptySet(), draftsAllowed)
}
