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

package com.ritense.buildingblock.repository

import com.ritense.buildingblock.domain.definition.BuildingBlockDefinition
import com.ritense.case.repository.CaseTabSpecificationHelper.Companion.ID
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import org.semver4j.Semver
import org.springframework.data.jpa.domain.Specification

class BuildingBlockDefinitionSpecificationHelper {

    companion object {

        const val KEY: String = "key"
        const val VERSION_TAG: String = "versionTag"
        const val ACTIVE: String = "active"
        const val FINAL: String = "final"
        const val NAME: String = "name"
        private const val LIKE_ESCAPE_CHARACTER: Char = '\\'

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

        @JvmStatic
        fun byIds(ids: Collection<BuildingBlockDefinitionId>) = Specification<BuildingBlockDefinition> { root, _, _ ->
            root.get<Any>(ID).`in`(ids)
        }

        /**
         * Matches [searchTerm] against the name and the key, case-insensitively. A blank term
         * matches everything, so it composes without the caller branching on it.
         */
        @JvmStatic
        fun bySearchTerm(searchTerm: String?) = Specification<BuildingBlockDefinition> { root, _, cb ->
            if (searchTerm.isNullOrBlank()) {
                cb.conjunction()
            } else {
                val pattern = "%${escapeLikeWildcards(searchTerm.trim().lowercase())}%"
                cb.or(
                    cb.like(cb.lower(root.get(NAME)), pattern, LIKE_ESCAPE_CHARACTER),
                    cb.like(cb.lower(root.get<Any>(ID).get(KEY)), pattern, LIKE_ESCAPE_CHARACTER)
                )
            }
        }

        /**
         * `%` and `_` are LIKE wildcards, so a term containing them would otherwise match far more
         * than the user typed - searching for `100%` would match any name starting with `100`.
         * Escaped here and paired with the explicit escape-character overload of `like`.
         */
        private fun escapeLikeWildcards(term: String): String = term
            .replace(LIKE_ESCAPE_CHARACTER.toString(), "$LIKE_ESCAPE_CHARACTER$LIKE_ESCAPE_CHARACTER")
            .replace("%", "$LIKE_ESCAPE_CHARACTER%")
            .replace("_", "${LIKE_ESCAPE_CHARACTER}_")
    }
}
