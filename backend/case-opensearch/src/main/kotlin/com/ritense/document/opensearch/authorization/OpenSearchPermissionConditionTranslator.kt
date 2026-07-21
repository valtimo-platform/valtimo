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

package com.ritense.document.opensearch.authorization

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationService
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.ContainerPermissionCondition
import com.ritense.authorization.permission.condition.ExpressionPermissionCondition
import com.ritense.authorization.permission.condition.FieldPermissionCondition
import com.ritense.authorization.permission.condition.PermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.authorization.role.Role
import com.ritense.document.domain.impl.JsonSchemaDocument
import com.ritense.document.repository.impl.JsonSchemaDocumentRepository
import com.ritense.valtimo.contract.authorization.CurrentUserExpressionHandler
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.index.query.BoolQueryBuilder
import org.opensearch.index.query.QueryBuilder
import org.opensearch.index.query.QueryBuilders

class OpenSearchPermissionConditionTranslator(
    private val openSearchMappers: List<OpenSearchAuthorizationEntityMapper<*, *>>,
    private val authorizationService: AuthorizationService,
    private val documentRepository: JsonSchemaDocumentRepository,
) {

    /**
     * Translates a list of [Permission]s into a single OpenSearch [QueryBuilder] that, when applied
     * to a search, returns only the documents the current user is allowed to see for [action].
     *
     * Permissions are OR-ed; conditions within a permission are AND-ed.
     * Returns a deny-all query if no permissions match [action].
     */
    fun toQuery(permissions: List<Permission>, action: Action<*>): QueryBuilder {
        val matching = permissions.filter {
            it.resourceType == JsonSchemaDocument::class.java && it.actions.contains(action)
        }
        logger.debug { "toQuery: ${permissions.size} permissions total, ${matching.size} matching action=$action" }
        if (matching.isEmpty()) {
            return denyAll()
        }

        val perPermissionQueries = matching.map { permission ->
            val conditionQueries = permission.conditionContainer.conditions.map { translateCondition(it) }
            andAll(conditionQueries)
        }
        val result = if (perPermissionQueries.size == 1) {
            perPermissionQueries.first()
        } else {
            QueryBuilders.boolQuery().apply {
                perPermissionQueries.forEach { should(it) }
                minimumShouldMatch(1)
            }
        }
        logger.debug { "toQuery: generated query for action=$action" }
        return result
    }

    private fun translateCondition(condition: PermissionCondition): QueryBuilder = when (condition) {
        is FieldPermissionCondition<*>      -> translateField(condition)
        is ExpressionPermissionCondition<*> -> translateExpression(condition)
        is ContainerPermissionCondition<*>  -> translateContainer(condition)
        else -> throw IllegalArgumentException("Unknown permission condition type: ${condition::class.qualifiedName}")
    }

    private fun translateField(cond: FieldPermissionCondition<*>): QueryBuilder {
        val baseField = jpaToOsField(cond.field)
        val value = resolveFieldValue(cond)
        val osField = if (isDynamicTextField(baseField, cond.operator, value)) "$baseField.keyword" else baseField
        return Companion.applyOperator(osField, cond.operator, value)
    }

    private fun translateExpression(cond: ExpressionPermissionCondition<*>): QueryBuilder {
        val dotPath = cond.path.removePrefix("$.").replace("/", ".")
        val baseField = "${jpaToOsField(cond.field)}.$dotPath"
        val value = CurrentUserExpressionHandler.resolveValue(cond.value)
        // Content sub-fields are dynamically mapped as text — use .keyword for string term queries
        val osField = if (isDynamicTextField(baseField, cond.operator, value)) "$baseField.keyword" else baseField
        logger.debug { "translateExpression: field=${cond.field} → osField=$osField, op=${cond.operator}, value=$value (${value?.javaClass?.simpleName})" }
        return Companion.applyOperator(osField, cond.operator, value)
    }

    @Suppress("UNCHECKED_CAST")
    private fun translateContainer(cond: ContainerPermissionCondition<*>): QueryBuilder {
        val osMapper = openSearchMappers.find {
            it.supports(JsonSchemaDocument::class.java, cond.resourceType)
        } as? OpenSearchAuthorizationEntityMapper<JsonSchemaDocument, Any>

        if (osMapper != null) {
            return osMapper.mapQuery(cond.conditions) ?: noFilter()
        }

        logger.warn {
            "No OpenSearchAuthorizationEntityMapper registered for " +
            "JsonSchemaDocument → ${cond.resourceType.simpleName}. " +
            "Falling back to JPA ID resolution — may be slow for large datasets."
        }
        return jpaFallback(cond)
    }

    /**
     * Fallback for [ContainerPermissionCondition] types that have no registered
     * [OpenSearchAuthorizationEntityMapper]. Uses JPA to find matching document IDs and
     * returns an `ids` query.
     */
    private fun jpaFallback(cond: ContainerPermissionCondition<*>): QueryBuilder {
        val syntheticPermission = Permission(
            resourceType = JsonSchemaDocument::class.java,
            actions = mutableListOf(Action<Any>(Action.IGNORE)),
            conditionContainer = ConditionContainer(listOf(cond)),
            role = Role(key = ""),
        )
        val spec = authorizationService.getAuthorizationSpecification(
            EntityAuthorizationRequest(JsonSchemaDocument::class.java, Action<JsonSchemaDocument>(Action.IGNORE)),
            listOf(syntheticPermission)
        )
        val allowedIds: List<String> = runWithoutAuthorization {
            documentRepository.findAll(spec).map { doc -> doc.id().toString() }
        }
        return QueryBuilders.idsQuery().addIds(*allowedIds.toTypedArray())
    }

    private fun resolveFieldValue(cond: FieldPermissionCondition<*>): Any? =
        if (cond.value is List<*>) {
            (cond.value as List<*>).map { CurrentUserExpressionHandler.resolveValue(it) }
        } else {
            CurrentUserExpressionHandler.resolveValue(cond.value)
        }

    companion object {
        private val logger = KotlinLogging.logger {}

        fun applyOperator(field: String, op: PermissionConditionOperator, value: Any?): QueryBuilder =
            when (op) {
                PermissionConditionOperator.EQUAL_TO -> {
                    if (value == null) {
                        QueryBuilders.boolQuery().mustNot(QueryBuilders.existsQuery(field))
                    } else {
                        QueryBuilders.termQuery(field, value)
                    }
                }
                PermissionConditionOperator.NOT_EQUAL_TO -> {
                    if (value == null) {
                        QueryBuilders.existsQuery(field)
                    } else {
                        QueryBuilders.boolQuery().mustNot(QueryBuilders.termQuery(field, value))
                    }
                }
                PermissionConditionOperator.GREATER_THAN ->
                    QueryBuilders.rangeQuery(field).gt(value)
                PermissionConditionOperator.GREATER_THAN_OR_EQUAL_TO ->
                    QueryBuilders.rangeQuery(field).gte(value)
                PermissionConditionOperator.LESS_THAN ->
                    QueryBuilders.rangeQuery(field).lt(value)
                PermissionConditionOperator.LESS_THAN_OR_EQUAL_TO ->
                    QueryBuilders.rangeQuery(field).lte(value)
                PermissionConditionOperator.LIST_CONTAINS ->
                    QueryBuilders.termQuery(field, value)
                PermissionConditionOperator.IN -> {
                    val collection = value as? Collection<*>
                        ?: throw IllegalArgumentException("IN operator requires a Collection value")
                    QueryBuilders.termsQuery(field, collection.toList())
                }
            }

        /**
         * Maps JPA entity field names (as used in [FieldPermissionCondition.field]) to
         * their corresponding field names in the OpenSearch document.
         */
        val fieldMappings: Map<String, String> = mapOf(
            "createdBy"           to "createdBy",
            "assigneeId"          to "assigneeId",
            "assigneeFullName"    to "assigneeFullName",
            "content"             to "content",
            "content.content"     to "content",
            "sequence"            to "sequence",
            "retentionDate"       to "retentionDate",
        )

        fun jpaToOsField(jpaField: String): String = fieldMappings[jpaField] ?: jpaField

        /**
         * Content sub-fields use dynamic mapping (text + keyword). String term queries
         * (EQUAL_TO, NOT_EQUAL_TO, LIST_CONTAINS, IN) need the .keyword sub-field for exact match.
         */
        fun isDynamicTextField(field: String, op: PermissionConditionOperator, value: Any?): Boolean {
            if (!field.startsWith("content.")) return false
            if (value == null) return false
            val isStringValue = value is String || (value is Collection<*> && value.firstOrNull() is String)
            val isTermOp = op in setOf(
                PermissionConditionOperator.EQUAL_TO,
                PermissionConditionOperator.NOT_EQUAL_TO,
                PermissionConditionOperator.LIST_CONTAINS,
                PermissionConditionOperator.IN,
            )
            return isStringValue && isTermOp
        }

        fun denyAll(): QueryBuilder = QueryBuilders.idsQuery()
        fun noFilter(): QueryBuilder = QueryBuilders.matchAllQuery()
        fun andAll(list: List<QueryBuilder>): QueryBuilder = when {
            list.isEmpty() -> noFilter()
            list.size == 1 -> list.first()
            else -> QueryBuilders.boolQuery().apply { list.forEach { must(it) } }
        }
    }
}
