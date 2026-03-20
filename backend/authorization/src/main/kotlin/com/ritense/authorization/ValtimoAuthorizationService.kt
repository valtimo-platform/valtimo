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

package com.ritense.authorization

import com.ritense.authorization.AuthorizationContext.Companion.runWithoutAuthorization
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.PermissionRepository
import com.ritense.authorization.request.AuthorizationRequest
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.authorization.request.RelatedEntityAuthorizationRequest
import com.ritense.authorization.role.Role
import com.ritense.authorization.specification.AuthorizationSpecification
import com.ritense.authorization.specification.AuthorizationSpecificationFactory
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.authentication.UserManagementService
import com.ritense.valtimo.contract.utils.SecurityUtils
import io.github.oshai.kotlinlogging.KotlinLogging
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type
import java.util.function.Supplier
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service

@Service
@SkipComponentScan
class ValtimoAuthorizationService(
    private val authorizationSpecificationFactories: List<AuthorizationSpecificationFactory<*>>,
    mappers: List<AuthorizationEntityMapper<*, *>>,
    private val actionProviders: List<ResourceActionProvider<*>>,
    private val permissionRepository: PermissionRepository,
    private val userManagementService: UserManagementService
) : AuthorizationService {

    private val mappers: List<AuthorizationEntityMapper<*, *>> = buildAllMappers(mappers)

    override fun <T : Any> requirePermission(
        request: AuthorizationRequest<T>
    ) {
        if (!hasPermission(request)) {
            if (request.action.key != Action.DENY) {
                logger.debug { "Unauthorized. User is missing permission '${request.action.key}' on '${request.resourceType}'." }
            }
            throw AccessDeniedException("Unauthorized")
        }
    }

    override fun <T : Any> getAuthorizedRoles(request: AuthorizationRequest<T>): Set<Role> {
        return getPermissions(request.resourceType, request.action)
            .groupBy { it.role }
            .filter { getAuthorizationSpecification(request, { it.value }, enablePermissionLogging = false).isAuthorized() }
            .map { it.key }
            .toSet()
    }

    /**
     *   Check for permissions for an (optional) related entity.
     *
     *   @param request the <code>AuthorizationRequest</code> to use when creating new requests
     */
    override fun <T : Any> hasPermission(
        request: AuthorizationRequest<T>
    ): Boolean {
        return getAuthorizationSpecification(request).isAuthorized()
    }

    override fun <T : Any> getAuthorizationSpecification(
        request: AuthorizationRequest<T>,
        permissions: List<Permission>?
    ): AuthorizationSpecification<T> {
        val usedPermissions = lazySupplier { permissions ?: getPermissions(request) }

        return getAuthorizationSpecification(request, usedPermissions, enablePermissionLogging = true)
    }

    override fun getPermissions(resourceType: Class<*>, action: Action<*>): List<Permission> {
        return permissionRepository.findAllByResourceTypeAndActions_Key(resourceType, action.key)
    }

    override fun <FROM, TO> getMapper(
        from: Class<FROM>,
        to: Class<TO>
    ): AuthorizationEntityMapper<FROM, TO> {
        return (mappers.firstOrNull {
            it.supports(from, to)
        } as AuthorizationEntityMapper<FROM, TO>?)
            ?: throw AccessDeniedException("No entity mapper found for given arguments.")
    }

    override fun <FROM, STEP, TO> buildChainedMapper(
        from: Class<FROM>,
        step: Class<STEP>,
        to: Class<TO>
    ): ChainedAuthorizationEntityMapper<FROM, STEP, TO>? {
        val byPair = LinkedHashMap<Pair<Class<*>, Class<*>>, AuthorizationEntityMapper<*, *>>()

        for (m in mappers) {
            val (from, to) = getMapperPair(m)
            byPair[from to to] = m
        }

        val mapper1 = byPair[from to step] ?: return null
        val mapper2 = byPair[step to to] ?: return null
        return chainedAuthorizationEntityMapper(
            mapper1,
            mapper2
        ) as ChainedAuthorizationEntityMapper<FROM, STEP, TO>
    }

    override fun <T : Any> getAvailableActionsForResource(clazz: Class<T>): List<Action<T>> {
        return actionProviders
            .filter { (it.javaClass.genericInterfaces[0] as ParameterizedType).actualTypeArguments[0] == clazz }
            .map { it as ResourceActionProvider<T> }
            .map { it.getAvailableActions() }
            .flatten()
    }

    private fun <T : Any> getAuthorizationSpecification(
        request: AuthorizationRequest<T>,
        permissionSupplier: () -> List<Permission>,
        enablePermissionLogging: Boolean
    ): AuthorizationSpecification<T> {
        if (enablePermissionLogging) {
            logPermissions(request, permissionSupplier)
        }

        val factory = (authorizationSpecificationFactories.firstOrNull {
            it.canCreate(request, permissionSupplier)
        } as AuthorizationSpecificationFactory<T>?)
            ?: throw AccessDeniedException("No specification found for given context.")
        return factory.create(request, permissionSupplier)
    }

    private fun getPermissions(context: AuthorizationRequest<*>): List<Permission> {
        val userRoles = if (context.user == null) {
            SecurityUtils.getCurrentUserRoles()
        } else {
            runWithoutAuthorization { userManagementService.findByUsername(context.user) }
                ?.roles
                ?: return emptyList()
        }
        return permissionRepository.findAllByRoleKeyInOrderByRoleKeyAscResourceTypeAsc(userRoles)
            .filter { permission ->
                context.resourceType == permission.resourceType
                    && permission.actions.contains(context.action)
                    && if (context is EntityAuthorizationRequest) {
                        permission.appliesInContext(context.context?.resourceType, context.context?.entity)
                    } else if (context is RelatedEntityAuthorizationRequest)
                    {
                        permission.appliesInContext(context.context?.resourceType, context.context?.entity)
                    } else {
                        val requestContextResourceType: Class<*>? = null
                        permission.appliesInContext(requestContextResourceType, null)
                    }
            }
    }

    private fun logPermissions(request: AuthorizationRequest<*>, permissionSupplier: Supplier<List<Permission>>) {
        val forUserLogLine = if (request.user.isNullOrEmpty()) "" else " for user '${request.user}'"
        if (!AuthorizationContext.ignoreAuthorization) {
            if (request.action.key == Action.DENY) {
                logger.error {
                    "Access denied on '${request.resourceType}'. This generally indicates attempting to " +
                        "access a resource without considering authorization. Please refer to the Valtimo documentation."
                }
            } else {
                val permissionsLogLine = permissionSupplier.get().joinToString(", ") { "${it.id}:${it.role.key}" }
                val logLine =
                    "Requesting permissions '${request.action.key}:${request.resourceType.simpleName}'$forUserLogLine and found matching permissions: [$permissionsLogLine]"
                logger.debug { logLine }
            }
        } else {
            if (request.action.key != Action.DENY) {
                val logLine =
                    "Ignoring authorization request for '${request.action.key}:${request.resourceType.simpleName}'$forUserLogLine. "
                logger.debug { logLine }
            }
        }
    }

    private fun <T> lazySupplier(delegate: () -> T) = object : () -> T {
        private val value by lazy(delegate)

        override fun invoke() = value
    }

    private fun buildAllMappers(mappers: List<AuthorizationEntityMapper<*, *>>): List<AuthorizationEntityMapper<*, *>> {
        val byPair = LinkedHashMap<Pair<Class<*>, Class<*>>, AuthorizationEntityMapper<*, *>>()

        for (m in mappers) {
            val (from, to) = getMapperPair(m)
            byPair[from to to] = m
        }

        var changed: Boolean
        do {
            changed = false
            val edges = byPair.keys.toList()

            for ((a, b) in edges) {
                for ((b2, c) in edges) {
                    if (b == b2 && a != c) {
                        val chainedKey = a to c
                        if (chainedKey !in byPair) {
                            byPair[chainedKey] = chainedAuthorizationEntityMapper(byPair[a to b]!!, byPair[b2 to c]!!)
                            changed = true
                        }
                    }
                }
            }
        } while (changed)

        return byPair.values.toList()
    }

    @Suppress("UNCHECKED_CAST")
    private fun chainedAuthorizationEntityMapper(
        first: AuthorizationEntityMapper<*, *>,
        second: AuthorizationEntityMapper<*, *>
    ): ChainedAuthorizationEntityMapper<*, *, *> = ChainedAuthorizationEntityMapper(
        first as AuthorizationEntityMapper<Any, Any>,
        second as AuthorizationEntityMapper<Any, Any>
    )

    companion object {
        private val logger = KotlinLogging.logger {}

        fun getMapperPair(mapper: AuthorizationEntityMapper<*, *>): Pair<Class<*>, Class<*>> {
            if (mapper is ChainedAuthorizationEntityMapper<*, *, *>) {
                val from = getMapperPair(mapper.first).first
                val to = getMapperPair(mapper.second).second
                return from to to
            }

            val iface = mapper.javaClass.genericInterfaces.asSequence()
                .filterIsInstance<ParameterizedType>()
                .firstOrNull { (it.rawType as? Class<*>) == AuthorizationEntityMapper::class.java }
                ?: error("Mapper ${mapper.javaClass.name} does not directly implement AuthorizationEntityMapper<From, To>")

            val from = iface.actualTypeArguments[0].asClass()
            val to = (iface.actualTypeArguments.getOrNull(2) ?: iface.actualTypeArguments[1]).asClass()
            return from to to
        }

        private fun Type.asClass(): Class<*> = when (this) {
            is Class<*> -> this
            is ParameterizedType -> (this.rawType as Class<*>)
            else -> Class.forName(this.typeName)
        }
    }
}