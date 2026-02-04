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

package com.ritense.form.domain

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.databind.annotation.JsonSerialize
import com.ritense.valtimo.contract.blueprint.BlueprintOwner
import com.ritense.valtimo.contract.blueprint.BlueprintOwnerHelper
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

@Embeddable
class FormDefinitionBlueprintId(
    @Enumerated(EnumType.STRING)
    @Column(name = "blueprint_type", length = 40, nullable = false)
    override var blueprintType: BlueprintType,

    @Column(name = "blueprint_key", length = 256, nullable = false)
    override var blueprintKey: String,

    @Convert(converter = SemverConverter::class)
    @JsonSerialize(using = SemverSerializer::class)
    @Column(name = "blueprint_version_tag", nullable = false)
    override var blueprintVersionTag: Semver,
) : BlueprintOwner, Serializable {

    init {
        BlueprintOwnerHelper.validateKey(blueprintKey)
    }

    @JsonIgnore
    override fun asCaseDefinitionId(): CaseDefinitionId? = super.asCaseDefinitionId()

    @JsonIgnore
    override fun asBuildingBlockDefinitionId(): BuildingBlockDefinitionId? = super.asBuildingBlockDefinitionId()

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is FormDefinitionBlueprintId) return false
        return BlueprintOwnerHelper.areEqual(this, other)
    }

    override fun hashCode(): Int = BlueprintOwnerHelper.computeHashCode(this)

    override fun toString(): String = "$blueprintType:$blueprintKey:$blueprintVersionTag"

    companion object {
        @JvmStatic
        fun forCase(caseDefinitionId: CaseDefinitionId): FormDefinitionBlueprintId {
            return BlueprintOwnerHelper.createForCase(caseDefinitionId) { type, key, version ->
                FormDefinitionBlueprintId(type, key, version)
            }
        }

        @JvmStatic
        fun forBuildingBlock(buildingBlockDefinitionId: BuildingBlockDefinitionId): FormDefinitionBlueprintId {
            return BlueprintOwnerHelper.createForBuildingBlock(buildingBlockDefinitionId) { type, key, version ->
                FormDefinitionBlueprintId(type, key, version)
            }
        }
    }
}
