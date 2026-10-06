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
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationContainerDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationContainerType
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationContainerType.BUILDING_BLOCK
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationContainerType.CASE
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationReferenceDto
import com.ritense.buildingblock.web.rest.dto.BuildingBlockVersionMigrationReferenceKind
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.semver4j.Semver
import java.util.UUID

/** A case definition version or building block version that holds building block references. */
data class MigrationContainer(
    val type: BuildingBlockVersionMigrationContainerType,
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
        fun of(id: BuildingBlockDefinitionId) = MigrationContainer(BUILDING_BLOCK, id.key, id.versionTag)
        fun of(id: CaseDefinitionId) = MigrationContainer(CASE, id.key, id.versionTag)
    }
}

data class MigrationContainerInfo(
    val container: MigrationContainer,
    val final: Boolean,
    val basedOnVersionTag: Semver?,
    val name: String?,
)

/** Where a reference lives inside its container; stable across draft copies, which give links new ids. */
sealed interface ReferenceLocation {
    val kind: BuildingBlockVersionMigrationReferenceKind
}

data class ProcessLinkLocation(
    val processDefinitionKey: String,
    val activityId: String,
) : ReferenceLocation {
    override val kind = BuildingBlockVersionMigrationReferenceKind.PROCESS_LINK
    override fun toString() = "$processDefinitionKey#$activityId"
}

data class CaseLinkLocation(
    val buildingBlockKey: String,
) : ReferenceLocation {
    override val kind = BuildingBlockVersionMigrationReferenceKind.CASE_LINK
    override fun toString() = "case-link#$buildingBlockKey"
}

/** One building block reference: a building block process link in an owned process, or a case definition building block link. */
data class UsageReference(
    val container: MigrationContainer,
    val location: ReferenceLocation,
    val child: BuildingBlockDefinitionId,
    val linkId: UUID,
    val processDefinitionId: String?,
    val inputMappings: List<BuildingBlockInputMapping>,
    val outputMappings: List<BuildingBlockOutputMapping>,
    val pluginConfigurationMappings: Map<String, UUID>,
) {
    fun matches(other: UsageReference) = location == other.location && child.key == other.child.key
}

class BuildingBlockUsageIndex(
    val references: List<UsageReference>,
    containers: Collection<MigrationContainerInfo>,
) {
    private val referencesByChild = references.groupBy { it.child }
    private val referencesByContainer = references.groupBy { it.container }
    private val containerInfo = containers.associateBy { it.container }
    private val containersByKey = containers.groupBy { it.container.type to it.container.key }

    fun referencesTo(child: BuildingBlockDefinitionId): List<UsageReference> = referencesByChild[child].orEmpty()

    fun referencesIn(container: MigrationContainer): List<UsageReference> = referencesByContainer[container].orEmpty()

    fun info(container: MigrationContainer): MigrationContainerInfo? = containerInfo[container]

    fun isFinal(container: MigrationContainer): Boolean = containerInfo[container]?.final ?: true

    fun versionsOf(type: BuildingBlockVersionMigrationContainerType, key: String): List<MigrationContainerInfo> =
        containersByKey[type to key].orEmpty()

    /** The open draft a developer is most likely working in: the highest non-final version of the key. */
    fun newestOpenDraft(container: MigrationContainer): MigrationContainerInfo? =
        versionsOf(container.type, container.key)
            .filter { !it.final }
            .maxWithOrNull { a, b -> a.container.versionTag.compareTo(b.container.versionTag) }

    /** The reference in [container] that corresponds to [reference] in another version of the same container. */
    fun findCorresponding(container: MigrationContainer, reference: UsageReference): UsageReference? {
        val candidates = referencesIn(container).filter { it.matches(reference) }
        return candidates.firstOrNull { it.child == reference.child } ?: candidates.singleOrNull()
    }
}

fun MigrationContainer.toDto(final: Boolean) = BuildingBlockVersionMigrationContainerDto(
    type = type,
    key = key,
    versionTag = versionTag.toString(),
    final = final,
)

fun UsageReference.toDto(index: BuildingBlockUsageIndex) = BuildingBlockVersionMigrationReferenceDto(
    container = container.toDto(index.isFinal(container)),
    kind = location.kind,
    processDefinitionKey = (location as? ProcessLinkLocation)?.processDefinitionKey,
    activityId = (location as? ProcessLinkLocation)?.activityId,
    buildingBlockKey = child.key,
    buildingBlockVersionTag = child.versionTag.toString(),
)
