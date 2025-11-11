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

package com.ritense.document.repository.impl.specification

import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.domain.JsonSchemaDocumentDefinitionSolutionModuleId
import com.ritense.document.domain.JsonSchemaDocumentDefinitionSolutionModuleType
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

        @JvmStatic
        fun byLatestVersion(): Specification<JsonSchemaDocumentDefinition> {
            return Specification { root: Root<JsonSchemaDocumentDefinition>,
                                   query: CriteriaQuery<*>,
                                   cb: CriteriaBuilder ->
                val solutionModulePath = root.get<Any>(ID).get<Any>(SOLUTION_MODULE_ID)
                val subquery = query.subquery(Long::class.java)
                val subRoot = subquery.from(CaseDefinition::class.java)
                subquery.select(cb.max(subRoot.get<Any>(ID).get(VERSION_TAG)))
                subquery.where(cb.equal(subRoot.get<Any>(ID).get<String>(KEY), solutionModulePath.get<String>(SOLUTION_MODULE_KEY)))

                cb.and(
                    cb.equal(solutionModulePath.get<JsonSchemaDocumentDefinitionSolutionModuleType>(SOLUTION_MODULE_TYPE), JsonSchemaDocumentDefinitionSolutionModuleType.CASE),
                    cb.equal(solutionModulePath.get<String>(SOLUTION_MODULE_VERSION_TAG), subquery)
                )
            }
        }

        @JvmStatic
        fun byIdCaseDefinitionId(caseDefinitionId: CaseDefinitionId): Specification<JsonSchemaDocumentDefinition> {
            val solutionModuleId = JsonSchemaDocumentDefinitionSolutionModuleId.forCase(caseDefinitionId)
            return Specification { root: Root<JsonSchemaDocumentDefinition>,
                                   _: CriteriaQuery<*>,
                                   cb: CriteriaBuilder ->
                val solutionModulePath = root.get<Any>(ID).get<Any>(SOLUTION_MODULE_ID)
                cb.and(
                    cb.equal(solutionModulePath.get<JsonSchemaDocumentDefinitionSolutionModuleType>(SOLUTION_MODULE_TYPE), JsonSchemaDocumentDefinitionSolutionModuleType.CASE),
                    cb.equal(solutionModulePath.get<String>(SOLUTION_MODULE_KEY), solutionModuleId.solutionModuleKey()),
                    cb.equal(solutionModulePath.get<String>(SOLUTION_MODULE_VERSION_TAG), solutionModuleId.solutionModuleVersionTag())
                )
            }
        }

        @JvmStatic
        fun byCaseDefinitionActive() = Specification<JsonSchemaDocumentDefinition> { root, query, cb ->
            val solutionModulePath = root.get<Any>(ID).get<Any>(SOLUTION_MODULE_ID)
            val subquery = query.subquery(Long::class.java)
            val subRoot = subquery.from(CaseDefinition::class.java)
            subquery.select(cb.count(subRoot.get<Any>(ID).get<CaseDefinitionId>(KEY)))
            subquery.where(
                cb.and(
                    cb.isTrue(subRoot["active"]),
                    cb.equal(subRoot.get<Any>(ID).get<String>(KEY), solutionModulePath.get<String>(SOLUTION_MODULE_KEY)),
                    cb.equal(subRoot.get<Any>(ID).get<Any>(VERSION_TAG), solutionModulePath.get<String>(SOLUTION_MODULE_VERSION_TAG))
                )
            )
            cb.and(
                cb.equal(solutionModulePath.get<JsonSchemaDocumentDefinitionSolutionModuleType>(SOLUTION_MODULE_TYPE), JsonSchemaDocumentDefinitionSolutionModuleType.CASE),
                cb.equal(subquery, 1L)
            )
        }

        private const val ID: String = "id"
        private const val SOLUTION_MODULE_ID: String = "solutionModuleId"
        private const val SOLUTION_MODULE_TYPE: String = "solutionModuleType"
        private const val SOLUTION_MODULE_KEY: String = "solutionModuleKey"
        private const val SOLUTION_MODULE_VERSION_TAG: String = "solutionModuleVersionTag"
        private const val KEY: String = "key"
        private const val VERSION_TAG: String = "versionTag"
        private const val NAME: String = "name"
    }
}
