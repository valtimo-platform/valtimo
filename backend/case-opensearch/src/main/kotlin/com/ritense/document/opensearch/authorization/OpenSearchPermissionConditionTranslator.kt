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
import org.opensearch.client.opensearch._types.FieldValue
import org.opensearch.client.opensearch._types.query_dsl.Query
import org.opensearch.client.json.JsonData

class OpenSearchPermissionConditionTranslator(
    private val openSearchMappers: List<OpenSearchAuthorizationEntityMapper<*, *>>,
    private val authorizationService: AuthorizationService,
    private val documentRepository: JsonSchemaDocumentRepository,
) {

    /**
     * Translates a list of [Permission]s into a single OpenSearch [Query] that, when applied
     * to a search, returns only the documents the current user is allowed to see for [action].
     *
     * Permissions are OR-ed; conditions within a permission are AND-ed.
     * Returns a deny-all query if no permissions match [action].
     */
    fun toQuery(permissions: List<Permission>, action: Action<*>): Query {
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
            Query.of { q -> q.bool { b -> b.should(perPermissionQueries).minimumShouldMatch("1") } }
        }
        logger.debug { "toQuery: generated query for action=$action" }
        return result
    }

    private fun translateCondition(condition: PermissionCondition): Query = when (condition) {
        is FieldPermissionCondition<*>      -> translateField(condition)
        is ExpressionPermissionCondition<*> -> translateExpression(condition)
        is ContainerPermissionCondition<*>  -> translateContainer(condition)
        else -> throw IllegalArgumentException("Unknown permission condition type: ${condition::class.qualifiedName}")
    }

    private fun translateField(cond: FieldPermissionCondition<*>): Query {
        val osField = jpaToOsField(cond.field)
        val value = resolveFieldValue(cond)
        return Companion.applyOperator(osField, cond.operator, value)
    }

    private fun translateExpression(cond: ExpressionPermissionCondition<*>): Query {
        val dotPath = cond.path.removePrefix("$.").replace("/", ".")
        val osField = "${jpaToOsField(cond.field)}.$dotPath"
        val value = CurrentUserExpressionHandler.resolveValue(cond.value)
        logger.debug { "translateExpression: field=${cond.field} → osField=$osField, op=${cond.operator}, value=$value (${value?.javaClass?.simpleName})" }
        return Companion.applyOperator(osField, cond.operator, value)
    }

    @Suppress("UNCHECKED_CAST")
    private fun translateContainer(cond: ContainerPermissionCondition<*>): Query {
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
    private fun jpaFallback(cond: ContainerPermissionCondition<*>): Query {
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
        return Query.of { q -> q.ids { i -> i.values(allowedIds) } }
    }

    private fun resolveFieldValue(cond: FieldPermissionCondition<*>): Any? =
        if (cond.value is List<*>) {
            (cond.value as List<*>).map { CurrentUserExpressionHandler.resolveValue(it) }
        } else {
            CurrentUserExpressionHandler.resolveValue(cond.value)
        }

    companion object {
        private val logger = KotlinLogging.logger {}

        fun applyOperator(field: String, op: PermissionConditionOperator, value: Any?): Query =
            when (op) {
                PermissionConditionOperator.EQUAL_TO -> {
                    if (value == null) {
                        Query.of { q -> q.bool { b -> b.mustNot(Query.of { q2 -> q2.exists { e -> e.field(field) } }) } }
                    } else {
                        Query.of { q -> q.term { t -> t.field(field).value(toFieldValue(value)) } }
                    }
                }
                PermissionConditionOperator.NOT_EQUAL_TO -> {
                    if (value == null) {
                        Query.of { q -> q.exists { e -> e.field(field) } }
                    } else {
                        Query.of { q -> q.bool { b -> b.mustNot(Query.of { q2 -> q2.term { t -> t.field(field).value(toFieldValue(value)) } }) } }
                    }
                }
                PermissionConditionOperator.GREATER_THAN ->
                    Query.of { q -> q.range { r -> r.untyped { u -> u.field(field).gt(JsonData.of(value)) } } }
                PermissionConditionOperator.GREATER_THAN_OR_EQUAL_TO ->
                    Query.of { q -> q.range { r -> r.untyped { u -> u.field(field).gte(JsonData.of(value)) } } }
                PermissionConditionOperator.LESS_THAN ->
                    Query.of { q -> q.range { r -> r.untyped { u -> u.field(field).lt(JsonData.of(value)) } } }
                PermissionConditionOperator.LESS_THAN_OR_EQUAL_TO ->
                    Query.of { q -> q.range { r -> r.untyped { u -> u.field(field).lte(JsonData.of(value)) } } }
                PermissionConditionOperator.LIST_CONTAINS ->
                    Query.of { q -> q.term { t -> t.field(field).value(toFieldValue(value)) } }
                PermissionConditionOperator.IN -> {
                    val collection = value as? Collection<*>
                        ?: throw IllegalArgumentException("IN operator requires a Collection value")
                    val fieldValues = collection.map { toFieldValue(it) }
                    Query.of { q -> q.terms { t -> t.field(field).terms { tv -> tv.value(fieldValues) } } }
                }
            }

        fun toFieldValue(value: Any?): FieldValue = when (value) {
            null -> FieldValue.NULL
            is String -> FieldValue.of(value)
            is Boolean -> FieldValue.of(value)
            is Long -> FieldValue.of(value)
            is Int -> FieldValue.of(value.toLong())
            is Double -> FieldValue.of(value)
            is Float -> FieldValue.of(value.toDouble())
            else -> FieldValue.of(value.toString())
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

        fun denyAll(): Query = Query.of { q -> q.ids { i -> i.values(emptyList()) } }
        fun noFilter(): Query = Query.of { q -> q.matchAll { m -> m } }
        fun andAll(list: List<Query>): Query = when {
            list.isEmpty() -> noFilter()
            list.size == 1 -> list.first()
            else -> Query.of { q -> q.bool { b -> b.must(list) } }
        }
    }
}
