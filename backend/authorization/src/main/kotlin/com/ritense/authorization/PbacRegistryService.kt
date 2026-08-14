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
    private val cacheLock = Any()

    @Volatile
    private var cachedRegistryMetadata: RegistryMetadata? = null

    @Volatile
    private var cachedScannedActionProviders: List<ResourceActionProvider<*>>? = null

    @Volatile
    private var cachedResourceTypeAllowlist: Set<String>? = null

    /**
     * The fully qualified class names that are valid authorization resource types.
     *
     * Used to guard reflective resolution of externally supplied resource names, see
     * [com.ritense.authorization.AuthorizationResourceTypeResolver]. Derived from the application
     * classpath and Spring configuration, so it is stable for the lifetime of the application.
     *
     * Deliberately does not reuse the registry metadata cache. Building that metadata also walks
     * the fields of every resource class reflectively, which is unnecessary here and too expensive
     * for a request path that is used on nearly every page.
     */
    fun getAllowedResourceTypes(): Set<String> {
        cachedResourceTypeAllowlist?.let { return it }

        return synchronized(cacheLock) {
            cachedResourceTypeAllowlist ?: createResourceTypeAllowlist().also {
                cachedResourceTypeAllowlist = it
            }
        }
    }

    private fun createResourceTypeAllowlist(): Set<String> {
        return discoverResourceTypes().keys + discoverSpecificationFactoryResourceTypes()
    }

    fun getRegistry(): PbacRegistryDto {
        val metadata = getOrCreateRegistryMetadata()

        return PbacRegistryDto(
            resources = metadata.resources,
            operators = metadata.operators,
            conditionTypes = metadata.conditionTypes,
            entityMappers = metadata.entityMappers,
            roles = roleRepository.findAll()
                .map { it.key }
                .sorted(),
        )
    }

    /**
     * Returns the immutable registry metadata.
     *
     * Resource types, actions, fields, operators, condition types and entity mappers are determined
     * by the application classpath and Spring configuration, so they do not change while the
     * application is running. The result is therefore built once and reused for subsequent calls.
     */
    private fun getOrCreateRegistryMetadata(): RegistryMetadata {
        cachedRegistryMetadata?.let { return it }

        return synchronized(cacheLock) {
            cachedRegistryMetadata ?: createRegistryMetadata().also {
                cachedRegistryMetadata = it
            }
        }
    }

    private fun createRegistryMetadata(): RegistryMetadata {
        val resourceTypes = discoverResourceTypes()
        val factoryResourceTypes = discoverSpecificationFactoryResourceTypes()
        val mapperPairs = discoverMapperPairs()

        val containerTargets = mapperPairs
            .groupBy { it.first }
            .mapValues { (_, pairs) ->
                pairs.map { it.second }
                    .distinct()
                    .sorted()
            }

        val allResourceTypes = (resourceTypes.keys + factoryResourceTypes)
            .distinct()
            .sorted()

        val resources = allResourceTypes.map { resourceType ->
            val resourceClass = tryLoadClass(resourceType)

            PbacResourceDto(
                resourceType = resourceType,
                shortName = resourceType.substringAfterLast('.'),
                actions = resourceTypes[resourceType]
                    ?.map { it.key }
                    ?.distinct()
                    ?: emptyList(),
                fields = resourceClass
                    ?.let(::extractFields)
                    ?: emptyList(),
                fieldAliases = resourceClass
                    ?.let(::extractFieldAliases)
                    ?: emptyList(),
                hasSpecificationFactory = resourceType in factoryResourceTypes,
                containerTargets = containerTargets[resourceType] ?: emptyList(),
            )
        }

        val operators = PermissionConditionOperator.entries.map {
            PbacOperatorDto(key = it.asText)
        }

        val conditionTypes = PermissionConditionType.entries.map {
            PbacConditionTypeDto(key = it.value)
        }

        val entityMappers = mapperPairs
            .map { (from, to) ->
                PbacEntityMapperDto(
                    fromResourceType = from,
                    toResourceType = to,
                )
            }
            .sortedWith(
                compareBy(
                    PbacEntityMapperDto::fromResourceType,
                    PbacEntityMapperDto::toResourceType,
                )
            )

        return RegistryMetadata(
            resources = resources,
            operators = operators,
            conditionTypes = conditionTypes,
            entityMappers = entityMappers,
        )
    }

    private fun discoverResourceTypes(): Map<String, List<Action<*>>> {
        val result = mutableMapOf<String, MutableList<Action<*>>>()

        for (provider in allActionProviders()) {
            val resourceType = extractTypeArguments(
                provider.javaClass,
                ResourceActionProvider::class.java,
            )?.firstOrNull() ?: continue

            result.getOrPut(resourceType.name) { mutableListOf() }
                .addAll(provider.getAvailableActions())
        }

        return result
    }

    /**
     * The Spring-injected [actionProviders] only contains providers registered as beans.
     *
     * Some [ResourceActionProvider] implementations are only used for their static action
     * constants and are not registered as beans. The classpath is therefore scanned for additional
     * implementations. Providers already supplied by Spring are not instantiated a second time.
     */
    private fun allActionProviders(): List<ResourceActionProvider<*>> {
        val beanClasses = actionProviders
            .map { it.javaClass }
            .toSet()

        val scannedProviders = scannedActionProviders()
            .filter { it.javaClass !in beanClasses }

        return actionProviders + scannedProviders
    }

    private fun scannedActionProviders(): List<ResourceActionProvider<*>> {
        cachedScannedActionProviders?.let { return it }

        return synchronized(cacheLock) {
            cachedScannedActionProviders ?: scanForActionProviders().also {
                cachedScannedActionProviders = it
            }
        }
    }

    private fun scanForActionProviders(): List<ResourceActionProvider<*>> {
        val scanner = ClassPathScanningCandidateComponentProvider(false).apply {
            addIncludeFilter(
                AssignableTypeFilter(ResourceActionProvider::class.java)
            )
        }

        return SCAN_BASE_PACKAGES
            .flatMap(scanner::findCandidateComponents)
            .mapNotNull { candidate ->
                val className = candidate.beanClassName
                    ?: return@mapNotNull null

                try {
                    val clazz = Class.forName(className)

                    if (clazz.isInterface || Modifier.isAbstract(clazz.modifiers)) {
                        return@mapNotNull null
                    }

                    clazz.getDeclaredConstructor()
                        .newInstance() as? ResourceActionProvider<*>
                } catch (exception: ReflectiveOperationException) {
                    logger.warn(exception) {
                        "Could not instantiate ResourceActionProvider '$className' " +
                            "while building the PBAC registry"
                    }
                    null
                } catch (exception: LinkageError) {
                    logger.warn(exception) {
                        "Could not load ResourceActionProvider '$className' " +
                            "while building the PBAC registry"
                    }
                    null
                }
            }
    }

    private fun discoverSpecificationFactoryResourceTypes(): Set<String> {
        val result = mutableSetOf<String>()

        for (factory in specificationFactories) {
            val resourceType = extractTypeArguments(
                factory.javaClass,
                AuthorizationSpecificationFactory::class.java,
            )?.firstOrNull() ?: continue

            result.add(resourceType.name)
        }

        return result
    }

    private fun discoverMapperPairs(): List<Pair<String, String>> {
        val result = mutableListOf<Pair<String, String>>()

        for (mapper in mappers) {
            val types = extractTypeArguments(
                mapper.javaClass,
                AuthorizationEntityMapper::class.java,
            )

            if (types != null && types.size >= 2) {
                result.add(types[0].name to types[1].name)
            }
        }

        return result.distinct()
    }

    /**
     * Resolves the concrete type arguments supplied for [targetInterface], while walking up the
     * superclass chain.
     *
     * Returns `null` when the interface is not found or an argument is not a concrete class, such
     * as an unresolved type variable or `Any`.
     */
    private fun extractTypeArguments(
        implClass: Class<*>,
        targetInterface: Class<*>,
    ): List<Class<*>>? {
        var currentClass: Class<*>? = implClass

        while (currentClass != null && currentClass != Any::class.java) {
            for (interfaceType in currentClass.genericInterfaces) {
                if (
                    interfaceType is ParameterizedType &&
                    interfaceType.rawType == targetInterface
                ) {
                    return interfaceType.actualTypeArguments.map { argument ->
                        if (argument is Class<*> && argument != Any::class.java) {
                            argument
                        } else {
                            return null
                        }
                    }
                }
            }

            currentClass = currentClass.superclass
        }

        return null
    }

    private fun extractFields(clazz: Class<*>): List<PbacConditionFieldDto> {
        return buildList {
            collectFields(
                clazz = clazz,
                prefix = "",
                depth = 0,
                path = mutableListOf(),
                into = this,
            )
        }
    }

    /**
     * Recursively collects condition fields as dotted paths, such as
     * `documentDefinitionId.id.key`.
     *
     * Recursion is bounded by depth and a total field cap, restricted to domain types and guarded
     * against cycles. Only class metadata is inspected; no resource instances are created.
     */
    private fun collectFields(
        clazz: Class<*>,
        prefix: String,
        depth: Int,
        path: MutableList<Class<*>>,
        into: MutableList<PbacConditionFieldDto>,
    ) {
        if (into.size >= MAX_FIELDS || clazz in path) {
            return
        }

        path.add(clazz)

        try {
            val seenFieldNames = mutableSetOf<String>()
            var currentClass: Class<*>? = clazz

            while (
                currentClass != null &&
                currentClass != Any::class.java &&
                into.size < MAX_FIELDS
            ) {
                for (field in currentClass.declaredFields) {
                    if (into.size >= MAX_FIELDS) {
                        break
                    }

                    if (field.name in seenFieldNames) continue
                    if (field.isSynthetic) continue
                    if (Modifier.isStatic(field.modifiers)) continue
                    if (field.name in EXCLUDED_FIELD_NAMES) continue

                    if (
                        field.name.length > 1 &&
                        field.name == field.name.uppercase()
                    ) {
                        continue
                    }

                    seenFieldNames.add(field.name)

                    val fieldPath = if (prefix.isEmpty()) {
                        field.name
                    } else {
                        "$prefix.${field.name}"
                    }

                    into.add(
                        PbacConditionFieldDto(
                            name = fieldPath,
                            type = simplifyTypeName(field.type),
                        )
                    )

                    if (
                        depth < MAX_FIELD_DEPTH &&
                        isNavigableType(field.type)
                    ) {
                        collectFields(
                            clazz = field.type,
                            prefix = fieldPath,
                            depth = depth + 1,
                            path = path,
                            into = into,
                        )
                    }
                }

                currentClass = currentClass.superclass
            }
        } finally {
            path.removeAt(path.lastIndex)
        }
    }

    /**
     * Only navigates into application domain types.
     *
     * JDK types, framework types, collections, maps, arrays and enums do not expose useful nested
     * PBAC comparison fields and would unnecessarily increase registry size.
     */
    private fun isNavigableType(type: Class<*>): Boolean {
        if (type.isPrimitive || type.isEnum || type.isArray) {
            return false
        }

        if (
            Collection::class.java.isAssignableFrom(type) ||
            Map::class.java.isAssignableFrom(type)
        ) {
            return false
        }

        return SCAN_BASE_PACKAGES.any { basePackage ->
            type.name.startsWith("$basePackage.")
        }
    }

    private fun extractFieldAliases(clazz: Class<*>): List<PbacFieldAliasDto> {
        val aliases = mutableListOf<PbacFieldAliasDto>()
        var currentClass: Class<*>? = clazz

        while (currentClass != null && currentClass != Any::class.java) {
            for (field in currentClass.declaredFields) {
                val annotation = field.getAnnotation(
                    AuthorizationFieldAlias::class.java
                ) ?: continue

                for (alias in annotation.names) {
                    aliases.add(
                        PbacFieldAliasDto(
                            alias = alias,
                            field = field.name,
                        )
                    )
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
        } catch (error: LinkageError) {
            logger.warn(error) {
                "Could not load resource class '$name' while building the PBAC registry"
            }
            null
        }
    }

    private data class RegistryMetadata(
        val resources: List<PbacResourceDto>,
        val operators: List<PbacOperatorDto>,
        val conditionTypes: List<PbacConditionTypeDto>,
        val entityMappers: List<PbacEntityMapperDto>,
    )

    companion object {
        private val logger = KotlinLogging.logger {}

        private val SCAN_BASE_PACKAGES = listOf(
            "com.ritense",
            "com.valtimo",
        )

        /**
         * Depth 3 permits paths containing four segments, such as `a.b.c.d`.
         */
        private const val MAX_FIELD_DEPTH = 3

        /**
         * Hard upper bound per resource to protect registry generation against unexpectedly large
         * object graphs.
         */
        private const val MAX_FIELDS = 500

        private val EXCLUDED_FIELD_NAMES = setOf(
            "serialVersionUID",
            "Companion",
            "logger",
            "LOG",
        )
    }
}