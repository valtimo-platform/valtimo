/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

package com.ritense.buildingblock.repository

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.case.repository.CaseTabSpecificationHelper.Companion.ID
import org.semver4j.Semver
import org.springframework.data.jpa.domain.Specification

class BuildingBlockDefinitionSpecificationHelper {

    companion object {

        const val KEY: String = "key"
        const val VERSION_TAG: String = "versionTag"
        const val ACTIVE: String = "active"
        const val FINAL: String = "final"

        @JvmStatic
        fun query() = Specification<BuildingBlockDefinition> { _, _, cb ->
            cb.conjunction()
        }

        @JvmStatic
        fun byActive(active: Boolean = true) = Specification<BuildingBlockDefinition> { root, _, cb ->
            cb.equal(root.get<Any>(ACTIVE), active)
        }

        @JvmStatic
        fun byFinal(final: Boolean = true) = Specification<BuildingBlockDefinition> { root, _, cb ->
            cb.equal(root.get<Any>(FINAL), final)
        }

        @JvmStatic
        fun byBuildingBlockDefinitionKey(caseDefinitionKey: String) = Specification<BuildingBlockDefinition> { root, _, cb ->
            cb.equal(root.get<Any>(ID).get<Any>(KEY), caseDefinitionKey)
        }

        @JvmStatic
        fun byBuildingBlockDefinitionVersionTag(caseDefinitionVersionTag: Semver) = Specification<BuildingBlockDefinition> { root, _, cb ->
            cb.equal(root.get<Any>(ID).get<Any>(VERSION_TAG), caseDefinitionVersionTag)
        }

    }
}