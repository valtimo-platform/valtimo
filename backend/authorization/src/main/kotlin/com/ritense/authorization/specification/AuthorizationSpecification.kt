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

package com.ritense.authorization.specification

import com.ritense.authorization.Action
import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.AuthorizationEntityMapper
import com.ritense.authorization.AuthorizationServiceHolder
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.ContainerPermissionCondition
import com.ritense.authorization.permission.condition.PermissionCondition
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.authorization.request.RelatedEntityAuthorizationRequest
import com.ritense.authorization.role.Role
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.persistence.criteria.AbstractQuery
import jakarta.persistence.criteria.CriteriaBuilder
import jakarta.persistence.criteria.CriteriaQuery
import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.Root
import org.springframework.data.jpa.domain.Specification

abstract class AuthorizationSpecification<T : Any>(
    protected val authRequest: AuthorizationRequest<T>,
    protected val permissionSupplier: () -> List<Permission>
) : Specification<T> {
    @Deprecated("Since 12.17.0", ReplaceWith("com.ritense.authorization.specification.AuthorizationSpecification(authRequest, permissionSupplier)"))
    constructor(authRequest: AuthorizationRequest<T>, permissions: List<Permission>) : this(authRequest, { permissions })

    protected val permissions by lazy { permissionSupplier() }

    internal open fun isAuthorized(): Boolean {
        return when (authRequest) {
            is EntityAuthorizationRequest<T> -> isAuthorizedForEntity(authRequest)
            is RelatedEntityAuthorizationRequest<T> -> isAuthorizedForRelatedEntity(authRequest)
            else -> false
        }
    }

    private fun isAuthorizedForEntity(entityAuthorizationRequest: EntityAuthorizationRequest<T>): Boolean {
        val entities = entityAuthorizationRequest.entities.ifEmpty { listOf(null) }
        val permissions = permissions.filter { permission ->
            entityAuthorizationRequest.resourceType == permission.resourceType && permission.actions.contains(entityAuthorizationRequest.action)
        }
        return entities.all { entity ->
            permissions.any { permission ->
                permission
                    .appliesTo(
                        entityAuthorizationRequest.resourceType,
                        entity,
                        entityAuthorizationRequest.context?.resourceType,
                        entityAuthorizationRequest.context?.entity
                    )
            }
        }
    }

    private fun isAuthorizedForRelatedEntity(
        relatedEntityAuthorizationRequest: RelatedEntityAuthorizationRequest<T>
    ): Boolean {

        if (relatedEntityAuthorizationRequest.resourceType == relatedEntityAuthorizationRequest.relatedResourceType) {
            val relatedEntity = identifierToEntityNullable(relatedEntityAuthorizationRequest.relatedResourceId)
            return isAuthorizedForEntityFromRelated(relatedEntityAuthorizationRequest, relatedEntity)
        }

        if (hasMapper(relatedEntityAuthorizationRequest.relatedResourceType, relatedEntityAuthorizationRequest.resourceType)) {
            val relatedEntity = resolveRelatedEntity(
                relatedEntityAuthorizationRequest.relatedResourceType,
                relatedEntityAuthorizationRequest.relatedResourceId
            )
            if (relatedEntity != null) {
                val mapper = AuthorizationServiceHolder.currentInstance.getMapper(
                    relatedEntityAuthorizationRequest.relatedResourceType,
                    relatedEntityAuthorizationRequest.resourceType
                ) as AuthorizationEntityMapper<Any, T>
                val entities = runWithoutAuthorization { mapper.mapRelated(relatedEntity) }
                return entities.all { entity ->
                    isAuthorizedForEntityFromRelated(relatedEntityAuthorizationRequest, entity)
                }
            }
        }

        return permissions
            .filter { permission ->
                relatedEntityAuthorizationRequest.resourceType == permission.resourceType
                    && permission.actions.contains(relatedEntityAuthorizationRequest.action)
            }
            .any { permission ->
                permission.appliesInContext(
                    relatedEntityAuthorizationRequest.context?.resourceType,
                    relatedEntityAuthorizationRequest.context?.entity
                ) && permission.conditionContainer.conditions.all { permissionCondition ->
                    isAuthorizedForRelatedEntityRecursive(
                        relatedEntityAuthorizationRequest,
                        permissionCondition
                    )
                }
            }
    }

    private fun isAuthorizedForEntityFromRelated(
        relatedEntityAuthorizationRequest: RelatedEntityAuthorizationRequest<T>,
        entity: T?
    ): Boolean {
        return isAuthorizedForEntity(
            EntityAuthorizationRequest(
                relatedEntityAuthorizationRequest.resourceType,
                relatedEntityAuthorizationRequest.action,
                entity
            ).apply {
                relatedEntityAuthorizationRequest.context?.let { context -> this.withContext(context) }
            }
        )
    }

    private fun isAuthorizedForRelatedEntityRecursive(
        relatedEntityAuthorizationRequest: RelatedEntityAuthorizationRequest<T>,
        permissionCondition: PermissionCondition
    ): Boolean {
        if (permissionCondition !is ContainerPermissionCondition<*>) {
            return true
        }

        return when {
            permissionCondition.resourceType == relatedEntityAuthorizationRequest.relatedResourceType
                || hasMapper(relatedEntityAuthorizationRequest.relatedResourceType, permissionCondition.resourceType) -> {
                this.findSpecification(relatedEntityAuthorizationRequest, permissionCondition).isAuthorized()
            }
            permissionCondition.resourceType == relatedEntityAuthorizationRequest.context?.resourceType
                || hasMapper(relatedEntityAuthorizationRequest.context?.resourceType, permissionCondition.resourceType) -> {
                this.findSpecificationFromContext(relatedEntityAuthorizationRequest, permissionCondition).isAuthorized()
            }
            else -> {
                permissionCondition.conditions.all {
                    isAuthorizedForRelatedEntityRecursive(relatedEntityAuthorizationRequest, it)
                }
            }
        }
    }

    private fun resolveRelatedEntity(relatedResourceType: Class<*>, relatedResourceId: String): Any? {
        val relatedSpec = AuthorizationServiceHolder.currentInstance.getAuthorizationSpecification(
            @Suppress("UNCHECKED_CAST")
            EntityAuthorizationRequest(relatedResourceType as Class<Any>, Action(Action.IGNORE)),
            emptyList()
        )
        return relatedSpec.identifierToEntityNullable(relatedResourceId)
    }

    private fun hasMapper(from: Class<*>?, to: Class<*>): Boolean {
        return from != null && AuthorizationServiceHolder.currentInstance.hasMapper(from, to)
    }

    fun combinePredicates(criteriaBuilder: CriteriaBuilder, predicates: List<Predicate>): Predicate {
        return criteriaBuilder.or(*predicates.toTypedArray())
    }

    private fun <TO : Any> findSpecification(
        authRequest: RelatedEntityAuthorizationRequest<T>,
        container: ContainerPermissionCondition<TO>
    ): AuthorizationSpecification<TO> {
        return AuthorizationServiceHolder.currentInstance.getAuthorizationSpecification(
            RelatedEntityAuthorizationRequest(
                container.resourceType,
                Action(Action.IGNORE),
                authRequest.relatedResourceType,
                authRequest.relatedResourceId
            ).apply {
                authRequest.context?.let { withContext(it) }
            },
            listOf(buildContainerPermission(container))
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun <TO : Any> findSpecificationFromContext(
        authRequest: RelatedEntityAuthorizationRequest<T>,
        container: ContainerPermissionCondition<TO>
    ): AuthorizationSpecification<TO> {
        val context = authRequest.context!!
        val entities = if (context.resourceType == container.resourceType) {
            listOf(context.entity as TO)
        } else {
            val mapper = AuthorizationServiceHolder.currentInstance.getMapper(
                context.resourceType,
                container.resourceType
            ) as AuthorizationEntityMapper<Any, TO>
            runWithoutAuthorization { mapper.mapRelated(context.entity as Any) }
        }

        return AuthorizationServiceHolder.currentInstance.getAuthorizationSpecification(
            EntityAuthorizationRequest(
                container.resourceType,
                Action(Action.IGNORE),
                entities
            ).apply {
                authRequest.context?.let { withContext(it) }
            },
            listOf(buildContainerPermission(container))
        )
    }

    private fun <TO : Any> buildContainerPermission(container: ContainerPermissionCondition<TO>): Permission {
        return Permission(
            resourceType = container.resourceType,
            actions = mutableListOf(Action<Any>(Action.IGNORE)),
            conditionContainer = ConditionContainer(container.conditions),
            role = Role(key = "")
        )
    }

    private fun identifierToEntityNullable(identifier: String): T? {
        return try {
            identifierToEntity(identifier)
        } catch (_: NotImplementedError) {
            null
        } catch (e: Throwable) {
            logger.error { e }
            null
        }
    }

    protected abstract fun identifierToEntity(identifier: String): T

    /**
     * Creates a WHERE clause for a query of the referenced entity in form of a Predicate for the given Root and
     * CriteriaQuery. This is only used when applying predicates to the root query for the entity. It is recommended to
     * implement {@link #toPredicate(Root, AbstractQuery, CriteriaBuilder) toPredicate} instead to ensure filters are
     * also applied when the entity is used in a relation.
     *
     * @param root must not be {@literal null}.
     * @param query must not be {@literal null}.
     * @param criteriaBuilder must not be {@literal null}.
     * @return a {@link Predicate}, may be {@literal null}.
     */
    override fun toPredicate(
        root: Root<T>,
        query: CriteriaQuery<*>,
        criteriaBuilder: CriteriaBuilder
    ): Predicate? {
        return toPredicate(root, query as AbstractQuery<*>, criteriaBuilder)
    }

    /**
     * Creates a WHERE clause for a query of the referenced entity in form of a Predicate for the given Root and
     * CriteriaQuery. This is used when applying predicates a subquery, and unless the default
     * {@link #toPredicate(Root, CriteriaQuery, CriteriaBuilder) toPredicate} is overridden, also to the root query.
     *
     * @param root must not be {@literal null}.
     * @param query must not be {@literal null}.
     * @param criteriaBuilder must not be {@literal null}.
     * @return a {@link Predicate}, may be {@literal null}.
     */
    abstract fun toPredicate(
        root: Root<T>,
        query: AbstractQuery<*>,
        criteriaBuilder: CriteriaBuilder
    ): Predicate

    companion object {
        private val logger = KotlinLogging.logger {}
    }
}