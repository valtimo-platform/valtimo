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

package com.ritense.document.mongodb.authorization

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
import org.springframework.data.mongodb.core.query.Criteria

class MongoPermissionConditionTranslator(
    private val mongoMappers: List<MongoAuthorizationEntityMapper<*, *>>,
    private val authorizationService: AuthorizationService,
    private val documentRepository: JsonSchemaDocumentRepository,
) {

    /**
     * Translates a list of [Permission]s into a single MongoDB [Criteria] that, when applied
     * to a query, returns only the documents the current user is allowed to see for [action].
     *
     * Permissions are OR-ed; conditions within a permission are AND-ed.
     * Returns a deny-all criteria if no permissions match [action].
     */
    fun toCriteria(permissions: List<Permission>, action: Action<*>): Criteria {
        val matching = permissions.filter {
            it.resourceType == JsonSchemaDocument::class.java && it.actions.contains(action)
        }
        logger.debug { "toCriteria: ${permissions.size} permissions total, ${matching.size} matching action=$action" }
        if (matching.isEmpty()) {
            return denyAll()
        }

        val perPermissionCriteria = matching.map { permission ->
            val conditionCriteria = permission.conditionContainer.conditions.map { translateCondition(it) }
            andAll(conditionCriteria)
        }
        val result = if (perPermissionCriteria.size == 1) {
            perPermissionCriteria.first()
        } else {
            Criteria().orOperator(*perPermissionCriteria.toTypedArray())
        }
        logger.debug { "toCriteria: generated criteria = ${result.criteriaObject}" }
        return result
    }

    private fun translateCondition(condition: PermissionCondition): Criteria = when (condition) {
        is FieldPermissionCondition<*>      -> translateField(condition)
        is ExpressionPermissionCondition<*> -> translateExpression(condition)
        is ContainerPermissionCondition<*>  -> translateContainer(condition)
        else -> throw IllegalArgumentException("Unknown permission condition type: ${condition::class.qualifiedName}")
    }

    private fun translateField(cond: FieldPermissionCondition<*>): Criteria {
        val mongoField = jpaToMongoField(cond.field)
        val value = resolveFieldValue(cond)
        return Companion.applyOperator(Criteria.where(mongoField), cond.operator, value)
    }

    private fun translateExpression(cond: ExpressionPermissionCondition<*>): Criteria {
        // Convert JSONPath "$.department.id" to MongoDB dot notation: "content.department.id"
        val dotPath = cond.path.removePrefix("$.").replace("/", ".")
        val mongoField = "${jpaToMongoField(cond.field)}.$dotPath"
        val value = CurrentUserExpressionHandler.resolveValue(cond.value)
        logger.debug { "translateExpression: field=${cond.field} → mongoField=$mongoField, op=${cond.operator}, value=$value (${value?.javaClass?.simpleName})" }
        return Companion.applyOperator(Criteria.where(mongoField), cond.operator, value)
    }

    @Suppress("UNCHECKED_CAST")
    private fun translateContainer(cond: ContainerPermissionCondition<*>): Criteria {
        val mongoMapper = mongoMappers.find {
            it.supports(JsonSchemaDocument::class.java, cond.resourceType)
        } as? MongoAuthorizationEntityMapper<JsonSchemaDocument, Any>

        if (mongoMapper != null) {
            return mongoMapper.mapCriteria(cond.conditions) ?: noFilter()
        }

        logger.warn {
            "No MongoAuthorizationEntityMapper registered for " +
            "JsonSchemaDocument → ${cond.resourceType.simpleName}. " +
            "Falling back to JPA ID resolution — may be slow for large datasets."
        }
        return jpaFallback(cond)
    }

    /**
     * Fallback for [ContainerPermissionCondition] types that have no registered
     * [MongoAuthorizationEntityMapper]. Uses JPA to find matching document IDs and
     * returns an [Criteria.where] `_id` `in` filter.
     *
     * This is correct but potentially expensive for large datasets. Register a
     * [MongoAuthorizationEntityMapper] to replace this with a native MongoDB query.
     */
    private fun jpaFallback(cond: ContainerPermissionCondition<*>): Criteria {
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
        return Criteria.where("_id").`in`(allowedIds)
    }


    private fun resolveFieldValue(cond: FieldPermissionCondition<*>): Any? =
        if (cond.value is List<*>) {
            (cond.value as List<*>).map { CurrentUserExpressionHandler.resolveValue(it) }
        } else {
            CurrentUserExpressionHandler.resolveValue(cond.value)
        }

    companion object {
        private val logger = KotlinLogging.logger {}

        fun applyOperator(criteria: Criteria, op: PermissionConditionOperator, value: Any?): Criteria =
            when (op) {
                PermissionConditionOperator.EQUAL_TO     -> criteria.`is`(value)
                PermissionConditionOperator.NOT_EQUAL_TO -> if (value == null) criteria.ne(null) else criteria.ne(value)
                PermissionConditionOperator.GREATER_THAN             -> criteria.gt(value!!)
                PermissionConditionOperator.GREATER_THAN_OR_EQUAL_TO -> criteria.gte(value!!)
                PermissionConditionOperator.LESS_THAN                -> criteria.lt(value!!)
                PermissionConditionOperator.LESS_THAN_OR_EQUAL_TO    -> criteria.lte(value!!)
                PermissionConditionOperator.LIST_CONTAINS            -> criteria.`in`(value)
                PermissionConditionOperator.IN                       -> {
                    val collection = value as? Collection<*>
                        ?: throw IllegalArgumentException("IN operator requires a Collection value")
                    criteria.`in`(collection)
                }
            }

        /**
         * Maps JPA entity field names (as used in [FieldPermissionCondition.field]) to
         * their corresponding field names in the MongoDB document.
         * Extend this map as new permission conditions are introduced.
         */
        val fieldMappings: Map<String, String> = mapOf(
            "createdBy"           to "createdBy",
            "assigneeId"          to "assigneeId",
            "assigneeFullName"    to "assigneeFullName",
            "content"             to "content",
            // JPA: DocumentContent wraps the JSON via @JsonValue, so the inner
            // "content.content" path in JPA resolves to the flat "content" in MongoDB.
            "content.content"     to "content",
            "sequence"            to "sequence",
            "retentionDate"       to "retentionDate",
        )

        fun jpaToMongoField(jpaField: String): String = fieldMappings[jpaField] ?: jpaField

        fun denyAll(): Criteria = Criteria.where("_id").`is`(null)
        fun noFilter(): Criteria = Criteria()
        fun andAll(list: List<Criteria>): Criteria = when {
            list.isEmpty() -> noFilter()
            list.size == 1 -> list.first()
            else -> Criteria().andOperator(*list.toTypedArray())
        }
    }
}
