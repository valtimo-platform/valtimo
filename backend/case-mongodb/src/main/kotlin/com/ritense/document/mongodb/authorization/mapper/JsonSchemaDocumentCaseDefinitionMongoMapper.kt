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

package com.ritense.document.mongodb.authorization.mapper

import com.ritense.authorization.permission.condition.FieldPermissionCondition
import com.ritense.authorization.permission.condition.PermissionCondition
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.mongodb.authorization.MongoAuthorizationEntityMapper
import com.ritense.document.mongodb.authorization.MongoPermissionConditionTranslator.Companion.andAll
import com.ritense.document.mongodb.authorization.MongoPermissionConditionTranslator.Companion.applyOperator
import com.ritense.valtimo.contract.authorization.CurrentUserExpressionHandler
import org.springframework.data.mongodb.core.query.Criteria

/**
 * Handles [com.ritense.authorization.permission.condition.ContainerPermissionCondition]
 * where the container resource type is [CaseDefinition].
 *
 * In the JPA model this relationship is expressed via `definitionId.blueprintId`
 * (blueprintType=CASE, blueprintKey, blueprintVersionTag) on [JsonSchemaDocument].
 * The same nested structure exists in the MongoDB document.
 */
class JsonSchemaDocumentCaseDefinitionMongoMapper : MongoAuthorizationEntityMapper<JsonSchemaDocument, CaseDefinition> {

    override fun mapCriteria(conditions: List<PermissionCondition>): Criteria? {
        if (conditions.isEmpty()) return null

        val conditionCriteria = conditions.map { condition ->
            when (condition) {
                is FieldPermissionCondition<*> -> {
                    val mongoField = mapCaseDefinitionField(condition.field)
                    val value = CurrentUserExpressionHandler.resolveValue(condition.value)
                    applyOperator(Criteria.where(mongoField), condition.operator, value)
                }
                else -> throw UnsupportedOperationException(
                    "Condition type ${condition::class.simpleName} is not supported in " +
                    "${this::class.simpleName}. Register a custom ${MongoAuthorizationEntityMapper::class.simpleName} " +
                    "or extend this mapper to handle it."
                )
            }
        }

        // Constrain to CASE blueprint type to exclude BUILDING_BLOCK documents
        val typeCriteria = Criteria.where("definitionId.blueprintId.blueprintType").`is`("CASE")
        return andAll(conditionCriteria + typeCriteria)
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean =
        fromClass == JsonSchemaDocument::class.java &&
        toClass == CaseDefinition::class.java

    private fun mapCaseDefinitionField(field: String): String = when (field) {
        "id.key"        -> "definitionId.blueprintId.blueprintKey"
        "id.versionTag" -> "definitionId.blueprintId.blueprintVersionTag"
        else -> throw UnsupportedOperationException(
            "Field '$field' on CaseDefinition is not yet mapped for MongoDB. " +
            "Add it to ${this::class.simpleName}."
        )
    }
}
