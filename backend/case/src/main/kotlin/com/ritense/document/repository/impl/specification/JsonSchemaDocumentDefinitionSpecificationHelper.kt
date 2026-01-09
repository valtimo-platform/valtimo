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

package com.ritense.document.repository.impl.specification

import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.JsonSchemaDocumentDefinitionBlueprintId
import com.ritense.document.domain.JsonSchemaDocumentDefinitionBlueprintType
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.valtimo.contract.BlueprintId
import com.ritense.valtimo.contract.buildingblock.BuildingBlockDefinitionId
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.CriteriaQuery
import jakarta.persistence.criteria.Root
import org.springframework.data.jpa.domain.Specification

class JsonSchemaDocumentDefinitionSpecificationHelper {

    companion object {
        @JvmStatic
        fun byIdName(name: String): Specification<JsonSchemaDocumentDefinition> {
            return Specification { root: Root<JsonSchemaDocumentDefinition>,
                                   _: CriteriaQuery<*>,
                                   criteriaBuilder: CriteriaBuilder ->
                criteriaBuilder.equal(root.get<Any>(ID).get<String>(NAME), name)
            }
        }

        // TODO: make this dynamic, blueprint type should be able to be passed. Alternatively, separate methods
        @JvmStatic
        fun byLatestVersion(): Specification<JsonSchemaDocumentDefinition> {
            return Specification { root: Root<JsonSchemaDocumentDefinition>,
                                   query: CriteriaQuery<*>,
                                   cb: CriteriaBuilder ->
                val blueprintPath = root.get<Any>(ID).get<Any>(BLUEPRINT_ID)
                val subquery = query.subquery(Long::class.java)
                val subRoot = subquery.from(CaseDefinition::class.java)
                subquery.select(cb.max(subRoot.get<Any>(ID).get(VERSION_TAG)))
                subquery.where(cb.equal(subRoot.get<Any>(ID).get<String>(KEY), blueprintPath.get<String>(BLUEPRINT_KEY)))

                cb.and(
                    cb.equal(blueprintPath.get<JsonSchemaDocumentDefinitionBlueprintType>(BLUEPRINT_TYPE), JsonSchemaDocumentDefinitionBlueprintType.CASE),
                    cb.equal(blueprintPath.get<String>(BLUEPRINT_VERSION_TAG), subquery)
                )
            }
        }

        // TODO: make this dynamic, blueprint type should be able to be passed. Alternatively, separate methods
        @JvmStatic
        fun byIdBlueprintId(blueprintId: BlueprintId): Specification<JsonSchemaDocumentDefinition> {
            val blueprintId =  if (blueprintId is CaseDefinitionId) {
                JsonSchemaDocumentDefinitionBlueprintId.forCase(blueprintId)
            } else {
                JsonSchemaDocumentDefinitionBlueprintId.forBuildingBlock(blueprintId as BuildingBlockDefinitionId)
            }
            return Specification { root: Root<JsonSchemaDocumentDefinition>,
                                   _: CriteriaQuery<*>,
                                   cb: CriteriaBuilder ->
                val blueprintPath = root.get<Any>(ID).get<Any>(BLUEPRINT_ID)
                cb.and(
                    cb.equal(blueprintPath.get<JsonSchemaDocumentDefinitionBlueprintType>(BLUEPRINT_TYPE), blueprintId.blueprintType),
                    cb.equal(blueprintPath.get<String>(BLUEPRINT_KEY), blueprintId.blueprintKey()),
                    cb.equal(blueprintPath.get<String>(BLUEPRINT_VERSION_TAG), blueprintId.blueprintVersionTag())
                )
            }
        }

        // TODO: make this dynamic, blueprint type should be able to be passed. Alternatively, separate methods
        @JvmStatic
        fun byIdCaseDefinitionId(caseDefinitionId: CaseDefinitionId): Specification<JsonSchemaDocumentDefinition> {
            val blueprintId = JsonSchemaDocumentDefinitionBlueprintId.forCase(caseDefinitionId)
            return Specification { root: Root<JsonSchemaDocumentDefinition>,
                                   _: CriteriaQuery<*>,
                                   cb: CriteriaBuilder ->
                val blueprintPath = root.get<Any>(ID).get<Any>(BLUEPRINT_ID)
                cb.and(
                    cb.equal(blueprintPath.get<JsonSchemaDocumentDefinitionBlueprintType>(BLUEPRINT_TYPE), JsonSchemaDocumentDefinitionBlueprintType.CASE),
                    cb.equal(blueprintPath.get<String>(BLUEPRINT_KEY), blueprintId.blueprintKey()),
                    cb.equal(blueprintPath.get<String>(BLUEPRINT_VERSION_TAG), blueprintId.blueprintVersionTag())
                )
            }
        }

        // TODO: make this dynamic, blueprint type should be able to be passed
        @JvmStatic
        fun byCaseDefinitionActive() = Specification<JsonSchemaDocumentDefinition> { root, query, cb ->
            val blueprintPath = root.get<Any>(ID).get<Any>(BLUEPRINT_ID)
            val subquery = query.subquery(Long::class.java)
            val subRoot = subquery.from(CaseDefinition::class.java)
            subquery.select(cb.count(subRoot.get<Any>(ID).get<CaseDefinitionId>(KEY)))
            subquery.where(
                cb.and(
                    cb.isTrue(subRoot["active"]),
                    cb.equal(subRoot.get<Any>(ID).get<String>(KEY), blueprintPath.get<String>(BLUEPRINT_KEY)),
                    cb.equal(subRoot.get<Any>(ID).get<Any>(VERSION_TAG), blueprintPath.get<String>(BLUEPRINT_VERSION_TAG))
                )
            )
            cb.and(
                cb.equal(blueprintPath.get<JsonSchemaDocumentDefinitionBlueprintType>(BLUEPRINT_TYPE), JsonSchemaDocumentDefinitionBlueprintType.CASE),
                cb.equal(subquery, 1L)
            )
        }

        private const val ID: String = "id"
        private const val BLUEPRINT_ID: String = "blueprintId"
        private const val BLUEPRINT_TYPE: String = "blueprintType"
        private const val BLUEPRINT_KEY: String = "blueprintKey"
        private const val BLUEPRINT_VERSION_TAG: String = "blueprintVersionTag"
        private const val KEY: String = "key"
        private const val VERSION_TAG: String = "versionTag"
        private const val NAME: String = "name"
    }
}
