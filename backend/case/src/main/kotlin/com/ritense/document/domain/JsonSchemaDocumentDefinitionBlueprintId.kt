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
package com.ritense.document.domain

import com.fasterxml.jackson.databind.annotation.JsonSerialize
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.repository.SemverConverter
import com.ritense.valtimo.contract.serializer.SemverSerializer
import com.ritense.valtimo.contract.utils.AssertionConcern
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Embeddable
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import org.semver4j.Semver
import java.io.Serializable
import java.util.Objects

@Embeddable
class JsonSchemaDocumentDefinitionBlueprintId(
    @Enumerated(EnumType.STRING)
    @Column(name = "blueprint_type", length = 40, nullable = false)
    var blueprintType: JsonSchemaDocumentDefinitionBlueprintType,
    @Column(name = "blueprint_key", length = 256, nullable = false)
    var blueprintKey: String,
    @Convert(converter = SemverConverter::class)
    @Column(name = "blueprint_version_tag", nullable = false)
    @JsonSerialize(using = SemverSerializer::class)
    var blueprintVersionTag: Semver,
) : Serializable {
    init {
        AssertionConcern.assertArgumentLength(blueprintKey,
            1,
            256,
            "blueprintKey must be between 1-256 characters"
        )
    }

    fun blueprintType(): JsonSchemaDocumentDefinitionBlueprintType {
        return blueprintType
    }

    fun blueprintKey(): String {
        return blueprintKey
    }

    fun blueprintVersionTag(): Semver {
        return blueprintVersionTag
    }

    fun asCaseDefinitionId(): CaseDefinitionId? {
        if (blueprintType != JsonSchemaDocumentDefinitionBlueprintType.CASE) {
            return null
        }
        return CaseDefinitionId.of(blueprintKey, blueprintVersionTag.toString())
    }

    fun asBuildingBlockDefinitionId(): BuildingBlockDefinitionId? {
        if (blueprintType != JsonSchemaDocumentDefinitionBlueprintType.BUILDING_BLOCK) {
            return null
        }
        return BuildingBlockDefinitionId.of(blueprintKey, blueprintVersionTag.toString())
    }

    override fun equals(o: Any?): Boolean {
        if (this === o) {
            return true
        }
        if (o !is JsonSchemaDocumentDefinitionBlueprintId) {
            return false
        }
        val that = o
        return blueprintType == that.blueprintType && blueprintKey == that.blueprintKey
            && blueprintVersionTag == that.blueprintVersionTag
    }

    override fun hashCode(): Int {
        return Objects.hash(blueprintType, blueprintKey, blueprintVersionTag)
    }

    companion object {
        fun forCase(caseDefinitionId: CaseDefinitionId?): JsonSchemaDocumentDefinitionBlueprintId {
            AssertionConcern.assertArgumentNotNull(caseDefinitionId, "caseDefinitionId is required")
            return JsonSchemaDocumentDefinitionBlueprintId(
                JsonSchemaDocumentDefinitionBlueprintType.CASE,
                caseDefinitionId!!.key,
                caseDefinitionId.versionTag
            )
        }

        fun forBuildingBlock(buildingBlockDefinitionId: BuildingBlockDefinitionId?): JsonSchemaDocumentDefinitionBlueprintId {
            AssertionConcern.assertArgumentNotNull(buildingBlockDefinitionId, "buildingBlockDefinitionId is required")
            return JsonSchemaDocumentDefinitionBlueprintId(
                JsonSchemaDocumentDefinitionBlueprintType.BUILDING_BLOCK,
                buildingBlockDefinitionId!!.key,
                buildingBlockDefinitionId.versionTag
            )
        }
    }
}