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

package com.ritense.valtimo.contract.blueprint.migration

import com.fasterxml.jackson.databind.annotation.JsonSerialize
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.blueprint.BlueprintType
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.repository.SemverConverter
import com.ritense.valtimo.contract.serializer.SemverSerializer
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Embeddable
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import org.semver4j.Semver
import java.io.Serializable

/** Identifies a single migration plan for any [BlueprintId]. Type + key + version are the target the plan migrates to; [migrationKey] is the plan's own stable key. Lives in the contract so unlinked modules can each key their own part of one plan. */
@Embeddable
data class BlueprintMigrationId(

    @Enumerated(EnumType.STRING)
    @Column(name = "blueprint_type", nullable = false)
    val blueprintType: BlueprintType,

    @Column(name = "blueprint_key", nullable = false)
    val key: String,

    @Convert(converter = SemverConverter::class)
    @Column(name = "blueprint_version_tag", nullable = false)
    @JsonSerialize(using = SemverSerializer::class)
    val versionTag: Semver,

    @Column(name = "migration_key", nullable = false)
    val migrationKey: String,
) : Serializable {

    /** Reconstruct the concrete [BlueprintId] this plan targets. */
    fun blueprintId(): BlueprintId = when (blueprintType) {
        BlueprintType.CASE -> CaseDefinitionId(key, versionTag)
        BlueprintType.BUILDING_BLOCK -> BuildingBlockDefinitionId(key, versionTag)
    }

    companion object {
        @JvmStatic
        fun from(blueprintId: BlueprintId, migrationKey: String): BlueprintMigrationId = BlueprintMigrationId(
            blueprintId.blueprintType(),
            blueprintId.getIdKey(),
            blueprintId.blueprintVersionTag(),
            migrationKey,
        )

        /** Build the concrete [BlueprintId] for a blueprint type + key + version. */
        @JvmStatic
        fun blueprintIdOf(blueprintType: BlueprintType, key: String, versionTag: Semver): BlueprintId =
            when (blueprintType) {
                BlueprintType.CASE -> CaseDefinitionId(key, versionTag)
                BlueprintType.BUILDING_BLOCK -> BuildingBlockDefinitionId(key, versionTag)
            }
    }
}
