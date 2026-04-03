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
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.domain.impl.JsonSchemaDocumentDefinition
import com.ritense.document.mongodb.authorization.MongoAuthorizationEntityMapper
import com.ritense.document.mongodb.authorization.MongoPermissionConditionTranslator.Companion.andAll
import com.ritense.document.mongodb.authorization.MongoPermissionConditionTranslator.Companion.applyOperator
import com.ritense.valtimo.contract.authorization.CurrentUserExpressionHandler
import org.springframework.data.mongodb.core.query.Criteria

/**
 * Handles [com.ritense.authorization.permission.condition.ContainerPermissionCondition]
 * where the container resource type is [JsonSchemaDocumentDefinition].
 *
 * In the JPA model this relationship is expressed via `definitionId.name` (and
 * `definitionId.version`) on [JsonSchemaDocument]. The same fields exist in the
 * MongoDB document under `definitionId.name` and `definitionId.version`.
 */
class JsonSchemaDocumentDefinitionMongoMapper : MongoAuthorizationEntityMapper<JsonSchemaDocument, JsonSchemaDocumentDefinition> {

    override fun mapCriteria(conditions: List<PermissionCondition>): Criteria? {
        if (conditions.isEmpty()) return null

        val criteria = conditions.map { condition ->
            when (condition) {
                is FieldPermissionCondition<*> -> {
                    val mongoField = mapDefinitionField(condition.field)
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
        return andAll(criteria)
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean =
        fromClass == JsonSchemaDocument::class.java &&
        toClass == JsonSchemaDocumentDefinition::class.java

    private fun mapDefinitionField(field: String): String = when (field) {
        "id.name"    -> "definitionId.name"
        "id.version" -> "definitionId.version"
        else -> throw UnsupportedOperationException(
            "Field '$field' on JsonSchemaDocumentDefinition is not yet mapped for MongoDB. " +
            "Add it to ${this::class.simpleName}."
        )
    }
}
