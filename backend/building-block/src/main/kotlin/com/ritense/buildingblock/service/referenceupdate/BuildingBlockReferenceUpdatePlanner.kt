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

import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.dto.BuildingBlockFieldDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.BUILDING_BLOCK
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.CASE
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver
import java.util.UUID

/** Path to the source version; [hops] run from the source link up to the top. */
data class ReferenceChain(
    val id: String,
    val hops: List<IndexedReference>,
    val cycle: Boolean,
) {
    val link: IndexedReference get() = hops.first()
    val top: IndexedReference get() = hops.last()
    val containers: List<ReferenceContainer> get() = hops.map { it.container }
}

/** The version of a container the reference update writes in. */
sealed interface WritableVersion {
    val original: ReferenceContainer
    val identity: ReferenceContainer
}

data class InPlaceDraft(override val original: ReferenceContainer) : WritableVersion {
    override val identity get() = original
}

data class ExistingDraft(override val original: ReferenceContainer, val draft: ReferenceContainerInfo) : WritableVersion {
    override val identity get() = draft.container
}

data class NewDraft(override val original: ReferenceContainer) : WritableVersion {
    override val identity get() = original
}

data class ChainDifferences(
    val existingInputMappings: List<BuildingBlockInputMapping>,
    val missingRequiredInputs: List<String>,
    val droppedInputMappings: List<BuildingBlockInputMapping>,
    val droppedOutputMappings: List<BuildingBlockOutputMapping>,
    val missingPluginDefinitionKeys: List<String>,
    val pluginConfigurationLink: IndexedReference?,
)

data class ChainResolution(
    val inputMappings: List<BuildingBlockInputMapping> = emptyList(),
    val pluginConfigurations: Map<String, UUID> = emptyMap(),
)

class ChainAnalysis(
    val chain: ReferenceChain,
    /** Hop index -> the version written in; the hops whose link is re-pointed. */
    val repointedHops: Map<Int, WritableVersion>,
    /** Hop index -> link in the written version; null when absent. */
    val effectiveLinks: Map<Int, IndexedReference?>,
    /** Top version receiving plugin configurations, if any. */
    val pluginWritable: WritableVersion?,
    val sourceLink: IndexedReference?,
    val topLink: IndexedReference?,
    val differences: ChainDifferences,
    val notUpdatableReason: String?,
    val allDrafts: Boolean,
) {
    val writables: List<WritableVersion> get() = (repointedHops.values + listOfNotNull(pluginWritable)).distinct()
    val updatable get() = notUpdatableReason == null
    val requiresDrafts get() = writables.any { it is NewDraft }
    val existingDrafts get() = writables.filterIsInstance<ExistingDraft>()
    val modifiesExistingDraft get() = existingDrafts.isNotEmpty()
    val selectedByDefault get() = allDrafts && updatable

    fun unresolvedRequiredInputs(resolution: ChainResolution?, targetFields: TargetFields): List<String> {
        if (resolution == null || resolution.inputMappings.isEmpty()) {
            return differences.missingRequiredInputs
        }
        val mapped = resolution.inputMappings.map { normalizeField(it.target) }
        return differences.missingRequiredInputs.filter { field -> !targetFields.isCovered(field, mapped) }
    }

    fun unresolvedPluginDefinitionKeys(resolution: ChainResolution?): List<String> =
        differences.missingPluginDefinitionKeys - resolution?.pluginConfigurations?.keys.orEmpty()

    fun configured(resolution: ChainResolution?, targetFields: TargetFields) =
        unresolvedRequiredInputs(resolution, targetFields).isEmpty() && unresolvedPluginDefinitionKeys(resolution).isEmpty()
}

class TargetFields(fields: List<BuildingBlockFieldDto>) {
    val names: Set<String> = fields.map { normalizeField(it.name) }.toSet()
    private val requiredNames = fields.filter { it.required }.map { normalizeField(it.name) }.toSet()

    /** Required fields with only required ancestors. */
    val required: List<String> = requiredNames
        .filter { name -> ancestorsOf(name).filter { it in names }.all { it in requiredNames } }
        .sorted()

    fun has(field: String) = normalizeField(field) in names

    fun isCovered(field: String, mappedTargets: Collection<String>) =
        mappedTargets.any { mapped -> field == mapped || field.startsWith("$mapped/") }

    private fun ancestorsOf(name: String): List<String> {
        val segments = name.removePrefix("/").split('/')
        return (1 until segments.size).map { "/" + segments.take(it).joinToString("/") }
    }
}

fun normalizeField(path: String): String {
    val withoutPrefix = path.removePrefix(DOC_PREFIX)
    val absolute = if (withoutPrefix.startsWith("/")) withoutPrefix else "/$withoutPrefix"
    return absolute.trimEnd('/')
}

private const val DOC_PREFIX = "doc:"

/** Plans chains, written versions and differences over a [BuildingBlockReferenceIndex]. */
class BuildingBlockReferenceUpdatePlanner(
    private val index: BuildingBlockReferenceIndex,
    private val source: BuildingBlockDefinitionId,
    private val target: BuildingBlockDefinitionId,
    private val targetFields: TargetFields,
    private val targetPluginDefinitionKeys: Set<String>,
    private val draftsAllowed: Boolean,
) {

    fun findChains(): List<ReferenceChain> {
        val chains = mutableListOf<ReferenceChain>()
        index.referencesTo(source).forEach { reference ->
            walkUp(listOf(reference), setOf(ReferenceContainer.of(source)), chains)
        }
        return chains.sortedWith(compareBy({ it.top.container.type }, { it.top.container.key }, { it.top.container.versionTag }, { it.id }))
    }

    private fun walkUp(path: List<IndexedReference>, visited: Set<ReferenceContainer>, chains: MutableList<ReferenceChain>) {
        val container = path.last().container
        if (container.type == CASE) {
            chains += chainOf(path, cycle = false)
            return
        }
        if (container in visited) {
            chains += chainOf(path, cycle = true)
            return
        }
        val parents = index.referencesTo(BuildingBlockDefinitionId(container.key, container.versionTag))
        if (parents.isEmpty()) {
            chains += chainOf(path, cycle = false)
            return
        }
        parents.forEach { parent -> walkUp(path + parent, visited + container, chains) }
    }

    private fun chainOf(path: List<IndexedReference>, cycle: Boolean): ReferenceChain {
        val signature = path.joinToString("|") { "${it.container.type}:${it.container.key}:${it.container.versionTag}:${it.location}" }
        return ReferenceChain(UUID.nameUUIDFromBytes(signature.toByteArray()).toString(), path, cycle)
    }

    fun analyze(chain: ReferenceChain): ChainAnalysis {
        val repointed = linkedMapOf<Int, WritableVersion>()
        for ((index, hop) in chain.hops.withIndex()) {
            val writable = writableFor(hop.container)
            repointed[index] = writable
            // In-place draft keeps its identity — nothing above changes
            if (writable is InPlaceDraft) break
        }

        val reasons = mutableListOf<String>()
        if (chain.cycle) {
            reasons += "The chain contains a cycle of building blocks referencing each other."
        }

        val effectiveLinks = repointed.mapValues { (hopIndex, writable) ->
            effectiveLink(writable, chain.hops[hopIndex], acceptedChildren(hopIndex, repointed), reasons)
        }
        val cycleThrough = repointed.values
            .filter { it !is NewDraft && it.identity.type == BUILDING_BLOCK }
            .firstOrNull { BuildingBlockDefinitionId(it.identity.key, it.identity.versionTag) in targetClosure }
        if (cycleThrough != null) {
            reasons += "Building block $target uses ${cycleThrough.identity}, so pointing that at $target creates a cycle."
        }
        if (target.key != source.key && alreadyLinksTarget(chain, repointed.getValue(0), effectiveLinks[0])) {
            reasons += "${repointed.getValue(0).identity} already links building block ${target.key}."
        }

        val top = chain.top
        val topIndex = chain.hops.lastIndex
        val topWritable = repointed[topIndex] ?: writableFor(top.container)
        val topIsCase = top.container.type == CASE
        val topLink = when {
            !topIsCase -> null
            effectiveLinks.containsKey(topIndex) -> effectiveLinks[topIndex]
            else -> effectiveLink(topWritable, top, acceptedChildren(topIndex, repointed), reasons)
        }

        val missingPluginKeys = if (topLink != null) {
            (targetPluginDefinitionKeys - topLink.pluginConfigurationMappings.keys).sorted()
        } else {
            emptyList()
        }
        val pluginWritable = if (missingPluginKeys.isNotEmpty()) topWritable else null

        if (!draftsAllowed) {
            reasons += "This environment does not allow drafts, so no draft can be created or changed."
        }

        val sourceLink = effectiveLinks[0]
        val existingInputs = sourceLink?.inputMappings ?: chain.link.inputMappings
        val existingOutputs = sourceLink?.outputMappings ?: chain.link.outputMappings
        val droppedInputs = existingInputs.filter { !targetFields.has(it.target) }
        val droppedOutputs = existingOutputs.filter { !targetFields.has(it.source) }
        val keptTargets = (existingInputs - droppedInputs.toSet()).map { normalizeField(it.target) }
        val missingRequired = targetFields.required.filter { !targetFields.isCovered(it, keptTargets) }

        return ChainAnalysis(
            chain = chain,
            repointedHops = repointed,
            effectiveLinks = effectiveLinks,
            pluginWritable = pluginWritable,
            sourceLink = sourceLink,
            topLink = topLink,
            differences = ChainDifferences(
                existingInputMappings = existingInputs,
                missingRequiredInputs = missingRequired,
                droppedInputMappings = droppedInputs,
                droppedOutputMappings = droppedOutputs,
                missingPluginDefinitionKeys = missingPluginKeys,
                pluginConfigurationLink = if (topIsCase) top else null,
            ),
            notUpdatableReason = reasons.distinct().takeIf { it.isNotEmpty() }?.joinToString(" "),
            allDrafts = chain.containers.none { index.isFinal(it) },
        )
    }

    private fun alreadyLinksTarget(chain: ReferenceChain, linkWritable: WritableVersion, link: IndexedReference?) =
        chain.link.location is CaseLinkLocation &&
            index.referencesIn(linkWritable.identity).any { it != link && it.location == CaseLinkLocation(target.key) }

    /** Target and every building block version it uses, transitively. */
    private val targetClosure: Set<BuildingBlockDefinitionId> by lazy {
        val visited = mutableSetOf<BuildingBlockDefinitionId>()
        val pending = ArrayDeque(listOf(target))
        while (pending.isNotEmpty()) {
            val next = pending.removeFirst()
            if (visited.add(next)) {
                pending += index.referencesIn(ReferenceContainer.of(next)).map { it.child }
            }
        }
        visited
    }

    private fun writableFor(container: ReferenceContainer): WritableVersion {
        if (!index.isFinal(container)) {
            return InPlaceDraft(container)
        }
        val openDraft = index.newestOpenDraft(container)
        return if (openDraft != null) ExistingDraft(container, openDraft) else NewDraft(container)
    }

    /** Versions an existing draft's link may already point at. */
    private fun acceptedChildren(hopIndex: Int, repointed: Map<Int, WritableVersion>): Set<BuildingBlockDefinitionId> {
        if (hopIndex == 0) {
            return setOf(target)
        }
        val below = repointed[hopIndex - 1]?.identity ?: return emptySet()
        return setOf(BuildingBlockDefinitionId(below.key, below.versionTag))
    }

    private fun effectiveLink(
        writable: WritableVersion,
        reference: IndexedReference,
        accepted: Set<BuildingBlockDefinitionId>,
        reasons: MutableList<String>,
    ): IndexedReference? {
        if (writable !is ExistingDraft) {
            return reference
        }
        val corresponding = index.findCorresponding(writable.draft.container, reference, accepted)
        if (corresponding == null) {
            reasons += "Open draft ${writable.draft.container} (based on ${writable.draft.basedOnVersionTag ?: "nothing"}) " +
                "no longer contains the reference ${reference.location} to building block ${reference.child.key}; " +
                "change that draft yourself."
        }
        return corresponding
    }

    /** One new version per key and base, bumped from the key's latest version. */
    fun allocateDraftVersions(bases: Collection<ReferenceContainer>): Map<ReferenceContainer, Semver> {
        val allocations = linkedMapOf<ReferenceContainer, Semver>()
        bases.distinct()
            .sortedWith(compareBy({ it.type }, { it.key }, { it.versionTag }))
            .forEach { base ->
                val taken = index.versionsOf(base.type, base.key).map { it.container.versionTag } +
                    allocations.filterKeys { it.type == base.type && it.key == base.key }.values
                var next = bump(taken.maxWithOrNull { a, b -> a.compareTo(b) } ?: base.versionTag)
                while (taken.any { it.isEqualTo(next) }) {
                    next = bump(next)
                }
                allocations[base] = next
            }
        return allocations
    }

    private fun bump(latest: Semver): Semver = when {
        source.key != target.key -> latest.nextMajor()
        source.versionTag.major != target.versionTag.major -> latest.nextMajor()
        source.versionTag.minor != target.versionTag.minor -> latest.nextMinor()
        else -> latest.nextPatch()
    }
}
