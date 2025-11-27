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

import com.ritense.document.domain.DocumentDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinitionId
import com.ritense.document.domain.JsonSchemaDocumentDefinitionSolutionModuleId
import com.ritense.document.domain.JsonSchemaDocumentDefinitionSolutionModuleType
import com.ritense.valtimo.contract.case_.CaseDefinitionId
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.CriteriaQuery
import jakarta.persistence.criteria.Root
import org.springframework.data.jpa.domain.Specification

class JsonSchemaDocumentSpecificationHelper {

    companion object {

        const val DOCUMENT_DEFINITION_ID: String = "documentDefinitionId"
        const val OWNER_ID: String = "solutionModuleId"
        const val OWNER_TYPE: String = "solutionModuleType"
        const val OWNER_KEY: String = "solutionModuleKey"
        const val OWNER_VERSION_TAG: String = "solutionModuleVersionTag"
        const val NAME: String = "name"
        const val ASSIGNEE_ID: String = "assigneeId"

        @JvmStatic
        fun byDocumentDefinitionIdName(name: String): Specification<JsonSchemaDocument> {
            return Specification { root: Root<JsonSchemaDocument>,
                                   _: CriteriaQuery<*>?,
                                   criteriaBuilder: CriteriaBuilder ->
                criteriaBuilder.equal(root.get<Any>(DOCUMENT_DEFINITION_ID).get<String>(NAME), name)
            }
        }

        @JvmStatic
        fun byDocumentDefinitionIdCaseDefinitionId(caseDefinitionId: CaseDefinitionId): Specification<JsonSchemaDocument> {
            val ownerId = JsonSchemaDocumentDefinitionSolutionModuleId.forCase(caseDefinitionId)
            return Specification { root: Root<JsonSchemaDocument>,
                                   _: CriteriaQuery<*>?,
                                   cb: CriteriaBuilder ->
                val ownerPath = root.get<Any>(DOCUMENT_DEFINITION_ID).get<Any>(OWNER_ID)
                cb.and(
                    cb.equal(ownerPath.get<JsonSchemaDocumentDefinitionSolutionModuleType>(OWNER_TYPE), JsonSchemaDocumentDefinitionSolutionModuleType.CASE),
                    cb.equal(ownerPath.get<String>(OWNER_KEY), ownerId.solutionModuleKey()),
                    cb.equal(ownerPath.get<String>(OWNER_VERSION_TAG), ownerId.solutionModuleVersionTag())
                )
            }
        }

        @JvmStatic
        fun byDocumentDefinitionId(id: DocumentDefinition.Id): Specification<JsonSchemaDocument> {
            val documentDefinitionId = JsonSchemaDocumentDefinitionId.existingId(id)
            return Specification { root: Root<JsonSchemaDocument>,
                                   _: CriteriaQuery<*>?,
                                   cb: CriteriaBuilder ->
                cb.equal(root.get<JsonSchemaDocumentDefinitionId>(DOCUMENT_DEFINITION_ID), documentDefinitionId)
            }
        }

        @JvmStatic
        fun byUnassigned() = Specification<JsonSchemaDocument> { root, _, cb ->
            cb.isNull(root.get<Any>(ASSIGNEE_ID))
        }
    }
}
