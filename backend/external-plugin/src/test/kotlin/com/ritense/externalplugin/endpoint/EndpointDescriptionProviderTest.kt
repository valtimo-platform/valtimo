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

package com.ritense.externalplugin.endpoint

import com.ritense.valtimo.contract.endpoint.EndpointDescriptionProvider
import com.ritense.valtimo.contract.endpoint.EndpointDescriptor
import org.junit.jupiter.api.Test
import org.springframework.core.io.support.PathMatchingResourcePatternResolver
import org.springframework.core.type.classreading.CachingMetadataReaderFactory
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestMapping
import java.lang.reflect.Method
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * Verifies that:
 * 1. Every management endpoint (from `@RequestMapping` annotated controllers) has a matching
 *    [EndpointDescriptor] registered via an [EndpointDescriptionProvider].
 * 2. Every descriptor includes both English and Dutch translations.
 * 3. No duplicate descriptors exist across providers.
 * 4. Only valid HTTP methods are used.
 *
 * This test uses bytecode/reflection scanning and does NOT require a Spring application context.
 */
class EndpointDescriptionProviderTest {

    private val requiredLocales = setOf("en", "nl")

    // ---- Provider scanning ----

    private fun findProviders(): List<EndpointDescriptionProvider> {
        val resolver = PathMatchingResourcePatternResolver()
        val readerFactory = CachingMetadataReaderFactory(resolver)
        val resources = resolver.getResources("classpath*:com/ritense/**/endpoint/*EndpointDescriptionProvider.class")
        val targetInterface = EndpointDescriptionProvider::class.java

        return resources.mapNotNull { resource ->
            try {
                val metadataReader = readerFactory.getMetadataReader(resource)
                val clazz = Class.forName(metadataReader.classMetadata.className)
                if (clazz.isInterface || java.lang.reflect.Modifier.isAbstract(clazz.modifiers)) return@mapNotNull null
                if (!targetInterface.isAssignableFrom(clazz)) return@mapNotNull null
                clazz.getDeclaredConstructor().newInstance() as EndpointDescriptionProvider
            } catch (_: Exception) {
                null
            }
        }
    }

    private fun allDescriptors(): List<Pair<String, EndpointDescriptor>> {
        return findProviders().flatMap { provider ->
            val name = provider::class.simpleName ?: "unknown"
            provider.getEndpointDescriptors().map { name to it }
        }
    }

    // ---- Controller scanning ----

    /**
     * Scans the classpath for all controller classes under `com.ritense` and extracts their
     * management endpoint method+pattern pairs using reflection on mapping annotations.
     * Returns pairs of ("CLASS_NAME", "METHOD /path/pattern").
     */
    private fun findManagementEndpoints(): List<Pair<String, String>> {
        val resolver = PathMatchingResourcePatternResolver()
        val readerFactory = CachingMetadataReaderFactory(resolver)
        val resources = resolver.getResources("classpath*:com/ritense/**/*.class")

        val endpoints = mutableListOf<Pair<String, String>>()

        for (resource in resources) {
            val clazz = try {
                val metadataReader = readerFactory.getMetadataReader(resource)
                Class.forName(metadataReader.classMetadata.className)
            } catch (_: Exception) {
                continue
            }

            // Only look at @Controller / @RestController classes
            val classAnnotations = clazz.annotations.map { it.annotationClass.qualifiedName }
            val isController = classAnnotations.any {
                it == "org.springframework.stereotype.Controller" ||
                    it == "org.springframework.web.bind.annotation.RestController"
            }
            if (!isController) continue

            val classMapping = clazz.getAnnotation(RequestMapping::class.java)
            val basePaths = classMapping?.value?.toList()
                ?: classMapping?.path?.toList()
                ?: listOf("")

            for (method in clazz.declaredMethods) {
                for ((httpMethod, paths) in extractMappings(method)) {
                    for (basePath in basePaths) {
                        for (methodPath in paths) {
                            val fullPath = normalizePath("$basePath/$methodPath")
                            endpoints.add(clazz.simpleName to "$httpMethod $fullPath")
                        }
                    }
                }
            }
        }

        return endpoints
    }

    private fun extractMappings(method: Method): List<Pair<String, List<String>>> {
        val mappings = mutableListOf<Pair<String, List<String>>>()

        method.getAnnotation(GetMapping::class.java)?.let {
            mappings.add("GET" to (it.value.toList().ifEmpty { it.path.toList() }).ifEmpty { listOf("") })
        }
        method.getAnnotation(PostMapping::class.java)?.let {
            mappings.add("POST" to (it.value.toList().ifEmpty { it.path.toList() }).ifEmpty { listOf("") })
        }
        method.getAnnotation(PutMapping::class.java)?.let {
            mappings.add("PUT" to (it.value.toList().ifEmpty { it.path.toList() }).ifEmpty { listOf("") })
        }
        method.getAnnotation(DeleteMapping::class.java)?.let {
            mappings.add("DELETE" to (it.value.toList().ifEmpty { it.path.toList() }).ifEmpty { listOf("") })
        }
        method.getAnnotation(PatchMapping::class.java)?.let {
            mappings.add("PATCH" to (it.value.toList().ifEmpty { it.path.toList() }).ifEmpty { listOf("") })
        }
        method.getAnnotation(RequestMapping::class.java)?.let { rm ->
            val methods = rm.method.map { it.name }.ifEmpty { listOf("GET") }
            val paths = (rm.value.toList().ifEmpty { rm.path.toList() }).ifEmpty { listOf("") }
            methods.forEach { m -> mappings.add(m to paths) }
        }

        return mappings
    }

    private fun normalizePath(path: String): String {
        val normalized = path.replace(Regex("/+"), "/")
        return if (normalized.endsWith("/") && normalized.length > 1) normalized.dropLast(1) else normalized
    }

    /**
     * Converts a controller path pattern like `/api/v1/document/{id}` to a descriptor-style
     * pattern. Descriptors use `{param}` placeholders which match controller path variables.
     */
    private fun descriptorMatchesEndpoint(descriptorPattern: String, endpointPattern: String): Boolean {
        // Normalize both: replace {paramName} with a common placeholder for comparison
        val normalize = { s: String -> s.replace(Regex("\\{[^}]+}"), "{*}") }
        return normalize(descriptorPattern) == normalize(endpointPattern)
    }

    // ---- Tests ----

    @Test
    fun `all management endpoints must have a descriptor with English and Dutch translations`() {
        val providers = findProviders()
        assertTrue(
            providers.isNotEmpty(),
            "No EndpointDescriptionProvider implementations found on classpath"
        )

        val descriptors = allDescriptors().map { it.second }
        val managementEndpoints = findManagementEndpoints()
            .filter { (_, endpoint) ->
                val path = endpoint.substringAfter(" ")
                path.startsWith("/api/management/")
                    // External plugin management endpoints are inherently blocked for external plugin
                    // service tokens (see ExternalPluginEndpointAllowlistFilter) so they don't need descriptors.
                    && !path.startsWith("/api/management/v1/external-plugin/")
            }

        assertTrue(
            managementEndpoints.isNotEmpty(),
            "No management endpoints found on classpath"
        )

        val missing = mutableListOf<String>()
        for ((controllerName, endpoint) in managementEndpoints) {
            val httpMethod = endpoint.substringBefore(" ")
            val path = endpoint.substringAfter(" ")
            val hasDescriptor = descriptors.any {
                it.method.uppercase() == httpMethod.uppercase() && descriptorMatchesEndpoint(it.pattern, path)
            }
            if (!hasDescriptor) {
                missing.add("$controllerName: $endpoint")
            }
        }

        if (missing.isNotEmpty()) {
            fail(
                "Found ${missing.size} endpoint(s) without an EndpointDescriptionProvider descriptor:\n" +
                    missing.sorted().joinToString("\n") { "  - $it" }
            )
        }
    }

    @Test
    fun `all endpoint descriptors must have English and Dutch translations`() {
        val failures = mutableListOf<String>()

        for ((providerName, descriptor) in allDescriptors()) {
            val missingLocales = requiredLocales - descriptor.descriptions.keys
            if (missingLocales.isNotEmpty()) {
                failures.add(
                    "$providerName: ${descriptor.method} ${descriptor.pattern} " +
                        "is missing translations for: ${missingLocales.joinToString(", ")}"
                )
            }
            for ((locale, description) in descriptor.descriptions) {
                if (description.isBlank()) {
                    failures.add(
                        "$providerName: ${descriptor.method} ${descriptor.pattern} " +
                            "has blank '$locale' translation"
                    )
                }
            }
        }

        if (failures.isNotEmpty()) {
            fail(
                "Found ${failures.size} endpoint descriptor translation issue(s):\n" +
                    failures.joinToString("\n") { "  - $it" }
            )
        }
    }

    @Test
    fun `endpoint descriptors must not have duplicate method-pattern combinations`() {
        val seen = mutableMapOf<String, String>()
        val duplicates = mutableListOf<String>()

        for ((providerName, descriptor) in allDescriptors()) {
            val key = "${descriptor.method.uppercase()}:${descriptor.pattern}"
            val existing = seen.putIfAbsent(key, providerName)
            if (existing != null) {
                duplicates.add("$key registered by both $existing and $providerName")
            }
        }

        if (duplicates.isNotEmpty()) {
            fail(
                "Found ${duplicates.size} duplicate endpoint descriptor(s):\n" +
                    duplicates.joinToString("\n") { "  - $it" }
            )
        }
    }

    @Test
    fun `endpoint descriptors must use valid HTTP methods`() {
        val validMethods = setOf("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
        val failures = mutableListOf<String>()

        for ((providerName, descriptor) in allDescriptors()) {
            if (descriptor.method.uppercase() !in validMethods) {
                failures.add(
                    "$providerName: invalid HTTP method '${descriptor.method}' for ${descriptor.pattern}"
                )
            }
        }

        if (failures.isNotEmpty()) {
            fail(
                "Found ${failures.size} invalid HTTP method(s):\n" +
                    failures.joinToString("\n") { "  - $it" }
            )
        }
    }
}
