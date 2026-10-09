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
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.BUILDING_BLOCK
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceUpdateContainerType.CASE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockReferenceKind
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.semver4j.Semver
import java.util.UUID

/** Case or building block version holding building block references. */
data class ReferenceContainer(
    val type: BuildingBlockReferenceUpdateContainerType,
    val key: String,
    val versionTag: Semver,
) {
    fun withVersion(versionTag: Semver) = copy(versionTag = versionTag)

    fun blueprintId(): BlueprintId = when (type) {
        CASE -> CaseDefinitionId.of(key, versionTag.toString())
        BUILDING_BLOCK -> BuildingBlockDefinitionId.of(key, versionTag.toString())
    }

    override fun toString() = "${type.name.lowercase().replace('_', ' ')} $key $versionTag"

    companion object {
        fun of(id: BuildingBlockDefinitionId) = ReferenceContainer(BUILDING_BLOCK, id.key, id.versionTag)
        fun of(id: CaseDefinitionId) = ReferenceContainer(CASE, id.key, id.versionTag)
    }
}

data class ReferenceContainerInfo(
    val container: ReferenceContainer,
    val final: Boolean,
    val basedOnVersionTag: Semver?,
    val name: String?,
)

/** Reference location in its container; stable across draft copies. */
sealed interface ReferenceLocation {
    val kind: BuildingBlockReferenceKind

    /** Same location once it references [buildingBlockKey]. */
    fun forKey(buildingBlockKey: String): ReferenceLocation
}

data class ProcessLinkLocation(
    val processDefinitionKey: String,
    val activityId: String,
) : ReferenceLocation {
    override val kind = BuildingBlockReferenceKind.PROCESS_LINK
    override fun forKey(buildingBlockKey: String) = this
    override fun toString() = "$processDefinitionKey#$activityId"
}

data class CaseLinkLocation(
    val buildingBlockKey: String,
) : ReferenceLocation {
    override val kind = BuildingBlockReferenceKind.CASE_LINK
    override fun forKey(buildingBlockKey: String) = CaseLinkLocation(buildingBlockKey)
    override fun toString() = "case-link#$buildingBlockKey"
}

/** Building block process link or case definition building block link. */
data class IndexedReference(
    val container: ReferenceContainer,
    val location: ReferenceLocation,
    val child: BuildingBlockDefinitionId,
    val linkId: UUID,
    val processDefinitionId: String?,
    val inputMappings: List<BuildingBlockInputMapping>,
    val outputMappings: List<BuildingBlockOutputMapping>,
    val pluginConfigurationMappings: Map<String, UUID>,
) {
    fun matches(other: IndexedReference) = location == other.location && child.key == other.child.key
}

class BuildingBlockReferenceIndex(
    val references: List<IndexedReference>,
    containers: Collection<ReferenceContainerInfo>,
) {
    private val referencesByChild = references.groupBy { it.child }
    private val referencesByContainer = references.groupBy { it.container }
    private val containerInfo = containers.associateBy { it.container }
    private val containersByKey = containers.groupBy { it.container.type to it.container.key }

    fun referencesTo(child: BuildingBlockDefinitionId): List<IndexedReference> = referencesByChild[child].orEmpty()

    fun referencesIn(container: ReferenceContainer): List<IndexedReference> = referencesByContainer[container].orEmpty()

    fun info(container: ReferenceContainer): ReferenceContainerInfo? = containerInfo[container]

    fun isFinal(container: ReferenceContainer): Boolean = containerInfo[container]?.final ?: true

    fun versionsOf(type: BuildingBlockReferenceUpdateContainerType, key: String): List<ReferenceContainerInfo> =
        containersByKey[type to key].orEmpty()

    /** Highest non-final version of the key. */
    fun newestOpenDraft(container: ReferenceContainer): ReferenceContainerInfo? =
        versionsOf(container.type, container.key)
            .filter { !it.final }
            .maxWithOrNull { a, b -> a.container.versionTag.compareTo(b.container.versionTag) }

    /** Counterpart of [reference] in [container], pointing at it or at [alsoAccepted]. */
    fun findCorresponding(
        container: ReferenceContainer,
        reference: IndexedReference,
        alsoAccepted: Set<BuildingBlockDefinitionId>,
    ): IndexedReference? {
        val references = referencesIn(container)
        return references.firstOrNull { it.matches(reference) && it.child == reference.child }
            ?: references
                .filter { it.child in alsoAccepted && it.location == reference.location.forKey(it.child.key) }
                .singleOrNull()
    }
}

fun ReferenceContainer.toDto(final: Boolean) = BuildingBlockReferenceUpdateContainerDto(
    type = type,
    key = key,
    versionTag = versionTag.toString(),
    final = final,
)

fun IndexedReference.toDto(index: BuildingBlockReferenceIndex) = BuildingBlockReferenceDto(
    container = container.toDto(index.isFinal(container)),
    kind = location.kind,
    processDefinitionKey = (location as? ProcessLinkLocation)?.processDefinitionKey,
    activityId = (location as? ProcessLinkLocation)?.activityId,
    buildingBlockKey = child.key,
    buildingBlockVersionTag = child.versionTag.toString(),
)
