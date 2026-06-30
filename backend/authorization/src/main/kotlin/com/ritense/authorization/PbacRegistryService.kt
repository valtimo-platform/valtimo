/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import com.ritense.authorization.permission.condition.AuthorizationFieldAlias
import com.ritense.authorization.permission.condition.PermissionConditionOperator
import com.ritense.authorization.permission.condition.PermissionConditionType
import com.ritense.authorization.role.RoleRepository
import com.ritense.authorization.specification.AuthorizationSpecificationFactory
import com.ritense.authorization.web.rest.dto.PbacConditionFieldDto
import com.ritense.authorization.web.rest.dto.PbacConditionTypeDto
import com.ritense.authorization.web.rest.dto.PbacEntityMapperDto
import com.ritense.authorization.web.rest.dto.PbacFieldAliasDto
import com.ritense.authorization.web.rest.dto.PbacOperatorDto
import com.ritense.authorization.web.rest.dto.PbacRegistryDto
import com.ritense.authorization.web.rest.dto.PbacResourceDto
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider
import org.springframework.core.type.filter.AssignableTypeFilter
import org.springframework.stereotype.Service
import java.lang.reflect.Modifier
import java.lang.reflect.ParameterizedType

@Service
@SkipComponentScan
class PbacRegistryService(
    private val actionProviders: List<ResourceActionProvider<*>>,
    private val mappers: List<AuthorizationEntityMapper<*, *>>,
    private val specificationFactories: List<AuthorizationSpecificationFactory<*>>,
    private val roleRepository: RoleRepository,
) {
    private var cachedScannedActionProviders: List<ResourceActionProvider<*>>? = null

    fun getRegistry(): PbacRegistryDto {
        val resourceTypes = discoverResourceTypes()
        val factoryResourceTypes = discoverSpecificationFactoryResourceTypes()
        val mapperPairs = discoverMapperPairs()

        val containerTargets = mapperPairs.groupBy { it.first }
            .mapValues { (_, pairs) -> pairs.map { it.second }.distinct() }

        val allResourceTypes = (resourceTypes.keys + factoryResourceTypes).distinct().sorted()

        val resources = allResourceTypes.map { resourceType ->
            val actions = resourceTypes[resourceType]?.map { it.key }?.distinct() ?: emptyList()
            val clazz = tryLoadClass(resourceType)
            val fields = clazz?.let { extractFields(it) } ?: emptyList()
            val aliases = clazz?.let { extractFieldAliases(it) } ?: emptyList()
            val hasFactory = factoryResourceTypes.contains(resourceType)
            val targets = containerTargets[resourceType]?.sorted() ?: emptyList()

            PbacResourceDto(
                resourceType = resourceType,
                shortName = resourceType.substringAfterLast('.'),
                actions = actions,
                fields = fields,
                fieldAliases = aliases,
                hasSpecificationFactory = hasFactory,
                containerTargets = targets,
            )
        }

        val operators = PermissionConditionOperator.entries.map {
            PbacOperatorDto(key = it.asText, label = operatorLabel(it))
        }

        val conditionTypes = PermissionConditionType.entries.map {
            PbacConditionTypeDto(key = it.value, label = conditionTypeLabel(it))
        }

        val entityMappers = mapperPairs.map { (from, to) ->
            PbacEntityMapperDto(fromResourceType = from, toResourceType = to)
        }.sortedWith(compareBy({ it.fromResourceType }, { it.toResourceType }))

        val roles = roleRepository.findAll().map { it.key }.sorted()

        return PbacRegistryDto(
            resources = resources,
            operators = operators,
            conditionTypes = conditionTypes,
            entityMappers = entityMappers,
            roles = roles,
        )
    }

    private fun discoverResourceTypes(): Map<String, List<Action<*>>> {
        val result = mutableMapOf<String, MutableList<Action<*>>>()
        for (provider in allActionProviders()) {
            val resourceType = extractGenericTypeArgument(
                provider.javaClass, ResourceActionProvider::class.java
            ) ?: continue
            val actions = provider.getAvailableActions()
            result.getOrPut(resourceType.name) { mutableListOf() }.addAll(actions)
        }
        return result
    }

    /**
     * The Spring-injected [actionProviders] only contains the providers that happen to be
     * registered as beans; many [ResourceActionProvider] implementations are only used for their
     * static action constants and are never registered. To report every resource's actions, the
     * classpath is also scanned for implementations (which all have no-arg constructors) and those
     * not already provided as beans are instantiated and merged in.
     */
    private fun allActionProviders(): List<ResourceActionProvider<*>> {
        val beanClasses = actionProviders.map { it.javaClass }.toSet()
        val scanned = scannedActionProviders().filter { it.javaClass !in beanClasses }
        return actionProviders + scanned
    }

    private fun scannedActionProviders(): List<ResourceActionProvider<*>> {
        return cachedScannedActionProviders ?: scanForActionProviders().also {
            cachedScannedActionProviders = it
        }
    }

    private fun scanForActionProviders(): List<ResourceActionProvider<*>> {
        val scanner = ClassPathScanningCandidateComponentProvider(false)
        scanner.addIncludeFilter(AssignableTypeFilter(ResourceActionProvider::class.java))

        return SCAN_BASE_PACKAGES.flatMap { basePackage ->
            scanner.findCandidateComponents(basePackage)
        }.mapNotNull { candidate ->
            val className = candidate.beanClassName ?: return@mapNotNull null
            try {
                val clazz = Class.forName(className)
                if (Modifier.isAbstract(clazz.modifiers)) return@mapNotNull null
                clazz.getDeclaredConstructor().newInstance() as? ResourceActionProvider<*>
            } catch (e: Exception) {
                logger.warn(e) { "Could not instantiate ResourceActionProvider '$className' while building the PBAC registry" }
                null
            }
        }
    }

    private fun discoverSpecificationFactoryResourceTypes(): Set<String> {
        val result = mutableSetOf<String>()
        for (factory in specificationFactories) {
            val resourceType = extractGenericTypeArgument(
                factory.javaClass, AuthorizationSpecificationFactory::class.java
            ) ?: continue
            result.add(resourceType.name)
        }
        return result
    }

    private fun discoverMapperPairs(): List<Pair<String, String>> {
        val result = mutableListOf<Pair<String, String>>()
        for (mapper in mappers) {
            val types = extractMapperTypeArguments(mapper.javaClass)
            if (types != null) {
                result.add(types.first.name to types.second.name)
            }
        }
        return result.distinct()
    }

    private fun extractGenericTypeArgument(
        implClass: Class<*>,
        targetInterface: Class<*>
    ): Class<*>? {
        var clazz: Class<*>? = implClass
        while (clazz != null && clazz != Any::class.java) {
            for (iface in clazz.genericInterfaces) {
                if (iface is ParameterizedType && iface.rawType == targetInterface) {
                    val arg = iface.actualTypeArguments[0]
                    return if (arg is Class<*> && arg != Any::class.java) arg else null
                }
            }
            clazz = clazz.superclass
        }
        return null
    }

    private fun extractMapperTypeArguments(implClass: Class<*>): Pair<Class<*>, Class<*>>? {
        var clazz: Class<*>? = implClass
        while (clazz != null && clazz != Any::class.java) {
            for (iface in clazz.genericInterfaces) {
                if (iface is ParameterizedType && iface.rawType == AuthorizationEntityMapper::class.java) {
                    val from = iface.actualTypeArguments[0]
                    val to = iface.actualTypeArguments[1]
                    return if (from is Class<*> && to is Class<*> && from != Any::class.java && to != Any::class.java) {
                        from to to
                    } else {
                        null
                    }
                }
            }
            clazz = clazz.superclass
        }
        return null
    }

    private fun extractFields(clazz: Class<*>): List<PbacConditionFieldDto> {
        val fields = mutableListOf<PbacConditionFieldDto>()
        val seen = mutableSetOf<String>()
        var currentClass: Class<*>? = clazz
        while (currentClass != null && currentClass != Any::class.java) {
            for (field in currentClass.declaredFields) {
                if (field.name in seen) continue
                if (field.isSynthetic) continue
                if (java.lang.reflect.Modifier.isStatic(field.modifiers)) continue
                val name = field.name
                // Skip common framework/internal fields
                if (name in EXCLUDED_FIELD_NAMES) continue
                // Skip all-uppercase constants
                if (name == name.uppercase() && name.length > 1) continue
                seen.add(name)
                fields.add(
                    PbacConditionFieldDto(
                        name = name,
                        type = simplifyTypeName(field.type),
                    )
                )
            }
            currentClass = currentClass.superclass
        }
        return fields
    }

    private fun extractFieldAliases(clazz: Class<*>): List<PbacFieldAliasDto> {
        val aliases = mutableListOf<PbacFieldAliasDto>()
        var currentClass: Class<*>? = clazz
        while (currentClass != null && currentClass != Any::class.java) {
            for (field in currentClass.declaredFields) {
                val annotation = field.getAnnotation(AuthorizationFieldAlias::class.java) ?: continue
                for (alias in annotation.names) {
                    aliases.add(PbacFieldAliasDto(alias = alias, field = field.name))
                }
            }
            currentClass = currentClass.superclass
        }
        return aliases
    }

    private fun simplifyTypeName(type: Class<*>): String {
        return type.simpleName
    }

    private fun tryLoadClass(name: String): Class<*>? {
        return try {
            Class.forName(name)
        } catch (_: ClassNotFoundException) {
            null
        }
    }

    private fun operatorLabel(operator: PermissionConditionOperator): String {
        return when (operator) {
            PermissionConditionOperator.NOT_EQUAL_TO -> "Not equal to"
            PermissionConditionOperator.EQUAL_TO -> "Equal to"
            PermissionConditionOperator.GREATER_THAN -> "Greater than"
            PermissionConditionOperator.GREATER_THAN_OR_EQUAL_TO -> "Greater than or equal to"
            PermissionConditionOperator.LESS_THAN -> "Less than"
            PermissionConditionOperator.LESS_THAN_OR_EQUAL_TO -> "Less than or equal to"
            PermissionConditionOperator.LIST_CONTAINS -> "List contains"
            PermissionConditionOperator.IN -> "In"
        }
    }

    private fun conditionTypeLabel(type: PermissionConditionType): String {
        return when (type) {
            PermissionConditionType.FIELD -> "Field condition"
            PermissionConditionType.EXPRESSION -> "Expression condition"
            PermissionConditionType.CONTAINER -> "Container condition"
        }
    }

    companion object {
        private val logger = KotlinLogging.logger {}

        private val SCAN_BASE_PACKAGES = listOf("com.ritense", "com.valtimo")

        private val EXCLUDED_FIELD_NAMES = setOf(
            "serialVersionUID", "Companion", "logger", "LOG",
        )
    }
}
