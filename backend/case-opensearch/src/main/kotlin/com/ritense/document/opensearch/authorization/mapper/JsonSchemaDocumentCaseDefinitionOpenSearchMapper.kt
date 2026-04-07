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

package com.ritense.document.opensearch.authorization.mapper

import com.ritense.authorization.permission.condition.FieldPermissionCondition
import com.ritense.authorization.permission.condition.PermissionCondition
import com.ritense.case_.domain.definition.CaseDefinition
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.opensearch.authorization.OpenSearchAuthorizationEntityMapper
import com.ritense.document.opensearch.authorization.OpenSearchPermissionConditionTranslator.Companion.andAll
import com.ritense.document.opensearch.authorization.OpenSearchPermissionConditionTranslator.Companion.applyOperator
import com.ritense.valtimo.contract.authorization.CurrentUserExpressionHandler
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.query_dsl.Query

/**
 * Handles [com.ritense.authorization.permission.condition.ContainerPermissionCondition]
 * where the container resource type is [CaseDefinition].
 *
 * Field paths mirror the MongoDB version: `definitionId.blueprintId.*`.
 */
class JsonSchemaDocumentCaseDefinitionOpenSearchMapper : OpenSearchAuthorizationEntityMapper<JsonSchemaDocument, CaseDefinition> {

    override fun mapQuery(conditions: List<PermissionCondition>): Query? {
        if (conditions.isEmpty()) return null

        val conditionQueries = conditions.map { condition ->
            when (condition) {
                is FieldPermissionCondition<*> -> {
                    val osField = mapCaseDefinitionField(condition.field)
                    val value = CurrentUserExpressionHandler.resolveValue(condition.value)
                    applyOperator(osField, condition.operator, value)
                }
                else -> throw UnsupportedOperationException(
                    "Condition type ${condition::class.simpleName} is not supported in " +
                    "${this::class.simpleName}. Register a custom ${OpenSearchAuthorizationEntityMapper::class.simpleName} " +
                    "or extend this mapper to handle it."
                )
            }
        }

        // Constrain to CASE blueprint type to exclude BUILDING_BLOCK documents
        val typeCriteria = Query.of { q ->
            q.term { t -> t.field("definitionId.blueprintId.blueprintType").value(FieldValue.of("CASE")) }
        }
        return andAll(conditionQueries + typeCriteria)
    }

    override fun supports(fromClass: Class<*>, toClass: Class<*>): Boolean =
        fromClass == JsonSchemaDocument::class.java &&
        toClass == CaseDefinition::class.java

    private fun mapCaseDefinitionField(field: String): String = when (field) {
        "id.key"        -> "definitionId.blueprintId.blueprintKey"
        "id.versionTag" -> "definitionId.blueprintId.blueprintVersionTag"
        else -> throw UnsupportedOperationException(
            "Field '$field' on CaseDefinition is not yet mapped for OpenSearch. " +
            "Add it to ${this::class.simpleName}."
        )
    }
}
