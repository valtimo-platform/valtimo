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

package com.ritense.valtimo.contract.blueprint

import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import org.semver4j.Semver

object BlueprintOwnerHelper {

    fun validateKey(key: String) {
        require(key.isNotBlank()) { "Blueprint key must not be blank" }
        require(key.length <= 256) { "Blueprint key must not exceed 256 characters" }
    }

    fun <T : BlueprintOwner> createForCase(
        caseDefinitionId: CaseDefinitionId,
        factory: (BlueprintType, String, Semver) -> T
    ): T {
        return factory(
            BlueprintType.CASE,
            caseDefinitionId.key,
            caseDefinitionId.versionTag
        )
    }

    fun <T : BlueprintOwner> createForBuildingBlock(
        buildingBlockDefinitionId: BuildingBlockDefinitionId,
        factory: (BlueprintType, String, Semver) -> T
    ): T {
        return factory(
            BlueprintType.BUILDING_BLOCK,
            buildingBlockDefinitionId.key,
            buildingBlockDefinitionId.versionTag
        )
    }

    fun areEqual(a: BlueprintOwner?, b: BlueprintOwner?): Boolean {
        if (a === b) return true
        if (a == null || b == null) return false
        return a.blueprintType == b.blueprintType &&
            a.blueprintKey == b.blueprintKey &&
            a.blueprintVersionTag == b.blueprintVersionTag
    }

    fun computeHashCode(owner: BlueprintOwner): Int {
        var result = owner.blueprintType.hashCode()
        result = 31 * result + owner.blueprintKey.hashCode()
        result = 31 * result + owner.blueprintVersionTag.hashCode()
        return result
    }
}
