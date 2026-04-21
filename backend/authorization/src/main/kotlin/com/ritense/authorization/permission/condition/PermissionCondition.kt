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

package com.ritense.authorization.permission.condition

import com.fasterxml.jackson.annotation.JsonPropertyOrder
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonTypeInfo
import com.fasterxml.jackson.annotation.JsonView
import com.ritense.authorization.permission.PermissionView
import com.ritense.valtimo.contract.database.QueryDialectHelper
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.Path
import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.Root
import java.lang.reflect.Field

@JsonTypeInfo(
    use = JsonTypeInfo.Id.NAME,
    include = JsonTypeInfo.As.EXISTING_PROPERTY,
    property = "type",
    visible = true
)
@JsonSubTypes(
    JsonSubTypes.Type(value = FieldPermissionCondition::class, name = "field"),
    JsonSubTypes.Type(value = ContainerPermissionCondition::class, name = "container"),
    JsonSubTypes.Type(value = ExpressionPermissionCondition::class, name = "expression")
)
@JsonPropertyOrder("type")
abstract class PermissionCondition(
    @field:JsonView(value = [PermissionView.RoleManagement::class, PermissionView.PermissionManagement::class])
    val type: PermissionConditionType
) {
    abstract fun <T: Any> isValid(entity: T): Boolean
    abstract fun <T: Any> toPredicate(
        root: Root<T>,
        query: AbstractQuery<*>,
        criteriaBuilder: CriteriaBuilder,
        resourceType: Class<T>,
        queryDialectHelper: QueryDialectHelper
    ): Predicate

    fun <T> createDatabaseObjectPath(field: String, root: Root<T>): Path<Any>? {
        var path: Path<Any>? = null
        var currentClass: Class<*>? = root.javaType

        field.split('.').forEach { segment ->
            val resolvedField = currentClass?.let { findDeclaredField(it, segment) }
            val resolvedSegment = resolvedField?.name ?: segment

            path = if (path == null) {
                root.get(resolvedSegment)
            } else {
                path!!.get(resolvedSegment)
            }

            currentClass = resolvedField?.type
        }

        return path
    }

    private fun findDeclaredField(clazz: Class<*>, fieldName: String): Field? {
        var classToSearch: Class<*>? = clazz
        while (classToSearch != null) {
            val match = classToSearch.declaredFields.firstOrNull { declared ->
                declared.name == fieldName ||
                    declared.getAnnotation(AuthorizationFieldAlias::class.java)?.names?.contains(fieldName) == true
            }
            if (match != null) {
                return match
            }
            classToSearch = classToSearch.superclass
        }
        return null
    }
}