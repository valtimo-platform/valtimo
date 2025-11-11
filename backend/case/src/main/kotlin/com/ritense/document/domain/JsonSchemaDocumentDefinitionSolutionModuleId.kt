/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import com.ritense.valtimo.contract.utils.AssertionConcern
import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import java.io.Serializable
import java.util.Objects

@Embeddable
class JsonSchemaDocumentDefinitionSolutionModuleId(
    @Enumerated(EnumType.STRING)
    @Column(name = "solution_module_type", length = 40, nullable = false)
    private var solutionModuleType: JsonSchemaDocumentDefinitionSolutionModuleType,
    @Column(name = "solution_module_key", length = 256, nullable = false)
    private var solutionModuleKey: String,
    @Column(name = "solution_module_version_tag", length = 200, nullable = false)
    private var solutionModuleVersionTag: String,
) : Serializable {
    init {
        AssertionConcern.assertArgumentLength(solutionModuleKey,
            1,
            256,
            "solutionModuleKey must be between 1-256 characters"
        )
        AssertionConcern.assertArgumentLength(
            solutionModuleVersionTag,
            1,
            200,
            "solutionModuleVersionTag must be between 1-200 characters"
        )
    }

    fun solutionModuleType(): JsonSchemaDocumentDefinitionSolutionModuleType {
        return solutionModuleType
    }

    fun solutionModuleKey(): String {
        return solutionModuleKey
    }

    fun solutionModuleVersionTag(): String {
        return solutionModuleVersionTag
    }

    fun asCaseDefinitionId(): CaseDefinitionId? {
        if (solutionModuleType != JsonSchemaDocumentDefinitionSolutionModuleType.CASE) {
            return null
        }
        return CaseDefinitionId.of(solutionModuleKey, solutionModuleVersionTag)
    }

    fun asBuildingBlockDefinitionId(): BuildingBlockDefinitionId? {
        if (solutionModuleType != JsonSchemaDocumentDefinitionSolutionModuleType.BUILDING_BLOCK) {
            return null
        }
        return BuildingBlockDefinitionId.of(solutionModuleKey, solutionModuleVersionTag)
    }

    override fun equals(o: Any?): Boolean {
        if (this === o) {
            return true
        }
        if (o !is JsonSchemaDocumentDefinitionSolutionModuleId) {
            return false
        }
        val that = o
        return solutionModuleType == that.solutionModuleType && solutionModuleKey == that.solutionModuleKey
            && solutionModuleVersionTag == that.solutionModuleVersionTag
    }

    override fun hashCode(): Int {
        return Objects.hash(solutionModuleType, solutionModuleKey, solutionModuleVersionTag)
    }

    companion object {
        fun forCase(caseDefinitionId: CaseDefinitionId?): JsonSchemaDocumentDefinitionSolutionModuleId {
            AssertionConcern.assertArgumentNotNull(caseDefinitionId, "caseDefinitionId is required")
            return JsonSchemaDocumentDefinitionSolutionModuleId(
                JsonSchemaDocumentDefinitionSolutionModuleType.CASE,
                caseDefinitionId!!.key,
                caseDefinitionId.versionTag.toString()
            )
        }

        fun forBuildingBlock(buildingBlockDefinitionId: BuildingBlockDefinitionId?): JsonSchemaDocumentDefinitionSolutionModuleId {
            AssertionConcern.assertArgumentNotNull(buildingBlockDefinitionId, "buildingBlockDefinitionId is required")
            return JsonSchemaDocumentDefinitionSolutionModuleId(
                JsonSchemaDocumentDefinitionSolutionModuleType.BUILDING_BLOCK,
                buildingBlockDefinitionId!!.key,
                buildingBlockDefinitionId.versionTag.toString()
            )
        }
    }
}