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

package com.ritense.buildingblock.service.versionmigration

import com.ritense.buildingblock.processlink.domain.BuildingBlockInputMapping
import com.ritense.buildingblock.processlink.domain.BuildingBlockOutputMapping
import com.ritense.buildingblock.processlink.dto.BuildingBlockFieldDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationContainerType.CASE
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver
import java.util.UUID

/** A reference to the source version and the path of containers above it, [hops] ordered from the link to the source up to the top container. */
data class MigrationChain(
    val id: String,
    val hops: List<UsageReference>,
    val cycle: Boolean,
) {
    val link: UsageReference get() = hops.first()
    val top: UsageReference get() = hops.last()
    val containers: List<MigrationContainer> get() = hops.map { it.container }
}

/** The version of a container the migration writes in. */
sealed interface WritableVersion {
    val original: MigrationContainer
    val identity: MigrationContainer
}

data class InPlaceDraft(override val original: MigrationContainer) : WritableVersion {
    override val identity get() = original
}

data class ExistingDraft(override val original: MigrationContainer, val draft: MigrationContainerInfo) : WritableVersion {
    override val identity get() = draft.container
}

data class NewDraft(override val original: MigrationContainer) : WritableVersion {
    override val identity get() = original
}

data class ChainDifferences(
    val existingInputMappings: List<BuildingBlockInputMapping>,
    val missingRequiredInputs: List<String>,
    val droppedInputMappings: List<BuildingBlockInputMapping>,
    val droppedOutputMappings: List<BuildingBlockOutputMapping>,
    val missingPluginDefinitionKeys: List<String>,
    val pluginConfigurationLink: UsageReference?,
)

data class ChainResolution(
    val inputMappings: List<BuildingBlockInputMapping> = emptyList(),
    val pluginConfigurations: Map<String, UUID> = emptyMap(),
)

class ChainAnalysis(
    val chain: MigrationChain,
    /** Hop index -> the version written in; the hops whose link is re-pointed. */
    val repointedHops: Map<Int, WritableVersion>,
    /** Hop index -> the link as it is in the version written in; null when that version lacks it. */
    val effectiveLinks: Map<Int, UsageReference?>,
    /** The top container's version, when the chain's plugin configurations have to be written there. */
    val pluginWritable: WritableVersion?,
    val sourceLink: UsageReference?,
    val topLink: UsageReference?,
    val differences: ChainDifferences,
    val notMigratableReason: String?,
    val allDrafts: Boolean,
) {
    val writables: List<WritableVersion> get() = (repointedHops.values + listOfNotNull(pluginWritable)).distinct()
    val migratable get() = notMigratableReason == null
    val requiresDrafts get() = writables.any { it is NewDraft }
    val existingDrafts get() = writables.filterIsInstance<ExistingDraft>()
    val modifiesExistingDraft get() = existingDrafts.isNotEmpty()
    val selectedByDefault get() = allDrafts && migratable

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

    /** Required fields whose every ancestor field is required too; a required child of an optional object is not required. */
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

/** Pure planning over a [BuildingBlockUsageIndex]: chains, the versions each chain writes in, and the per-chain differences. */
class BuildingBlockVersionMigrationPlanner(
    private val index: BuildingBlockUsageIndex,
    private val source: BuildingBlockDefinitionId,
    private val target: BuildingBlockDefinitionId,
    private val targetFields: TargetFields,
    private val targetPluginDefinitionKeys: Set<String>,
    private val draftsAllowed: Boolean,
) {

    fun findChains(): List<MigrationChain> {
        val chains = mutableListOf<MigrationChain>()
        index.referencesTo(source).forEach { reference ->
            walkUp(listOf(reference), setOf(MigrationContainer.of(source)), chains)
        }
        return chains.sortedWith(compareBy({ it.top.container.type }, { it.top.container.key }, { it.top.container.versionTag }, { it.id }))
    }

    private fun walkUp(path: List<UsageReference>, visited: Set<MigrationContainer>, chains: MutableList<MigrationChain>) {
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

    private fun chainOf(path: List<UsageReference>, cycle: Boolean): MigrationChain {
        val signature = path.joinToString("|") { "${it.container.type}:${it.container.key}:${it.container.versionTag}:${it.location}" }
        return MigrationChain(UUID.nameUUIDFromBytes(signature.toByteArray()).toString(), path, cycle)
    }

    fun analyze(chain: MigrationChain): ChainAnalysis {
        val repointed = linkedMapOf<Int, WritableVersion>()
        for ((index, hop) in chain.hops.withIndex()) {
            val writable = writableFor(hop.container)
            repointed[index] = writable
            // A draft keeps its identity when it is changed in place, so nothing above it has to follow.
            if (writable is InPlaceDraft) break
        }

        val reasons = mutableListOf<String>()
        if (chain.cycle) {
            reasons += "The chain contains a cycle of building blocks referencing each other."
        }

        val effectiveLinks = repointed.mapValues { (hopIndex, writable) ->
            effectiveLink(writable, chain.hops[hopIndex], acceptedChildren(hopIndex, repointed), reasons)
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
            notMigratableReason = reasons.distinct().takeIf { it.isNotEmpty() }?.joinToString(" "),
            allDrafts = chain.containers.none { index.isFinal(it) },
        )
    }

    private fun writableFor(container: MigrationContainer): WritableVersion {
        if (!index.isFinal(container)) {
            return InPlaceDraft(container)
        }
        val openDraft = index.newestOpenDraft(container)
        return if (openDraft != null) ExistingDraft(container, openDraft) else NewDraft(container)
    }

    /** The versions an existing draft's link may already point at besides the chain's own: the target, or the version written one hop below. */
    private fun acceptedChildren(hopIndex: Int, repointed: Map<Int, WritableVersion>): Set<BuildingBlockDefinitionId> {
        if (hopIndex == 0) {
            return setOf(target)
        }
        val below = repointed[hopIndex - 1]?.identity ?: return emptySet()
        return setOf(BuildingBlockDefinitionId(below.key, below.versionTag))
    }

    private fun effectiveLink(
        writable: WritableVersion,
        reference: UsageReference,
        accepted: Set<BuildingBlockDefinitionId>,
        reasons: MutableList<String>,
    ): UsageReference? {
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

    /** One new version per key and base, bumped from the key's latest version by the component that differs between source and target. */
    fun allocateDraftVersions(bases: Collection<MigrationContainer>): Map<MigrationContainer, Semver> {
        val allocations = linkedMapOf<MigrationContainer, Semver>()
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
        source.versionTag.major != target.versionTag.major -> latest.nextMajor()
        source.versionTag.minor != target.versionTag.minor -> latest.nextMinor()
        else -> latest.nextPatch()
    }
}
