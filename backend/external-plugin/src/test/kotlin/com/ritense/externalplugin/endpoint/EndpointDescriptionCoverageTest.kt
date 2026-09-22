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

import com.ritense.valtimo.contract.endpoint.EndpointDescription
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
import java.lang.reflect.Modifier
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * Enforces that every REST endpoint exposed by a controller on the classpath documents itself with
 * an [EndpointDescription] carrying both an English and a Dutch text. The descriptions are the
 * single source of truth shown to an admin when granting an external plugin access to endpoints.
 *
 * This covers **all** endpoints, not just management ones, so the requirement cannot silently drift
 * as new controllers are added. It uses bytecode/reflection scanning and does NOT require a Spring
 * application context. The set of controllers it sees is determined by the modules on the
 * external-plugin test classpath (see this module's build.gradle).
 */
class EndpointDescriptionCoverageTest {

    @Test
    fun `every controller endpoint must declare an EndpointDescription with English and Dutch text`() {
        val endpoints = findEndpointMethods()
        assertTrue(
            endpoints.isNotEmpty(),
            "No controller endpoints found on the classpath — the scan is probably misconfigured"
        )

        val failures = mutableListOf<String>()
        for ((controller, method) in endpoints) {
            val annotation = method.getAnnotation(EndpointDescription::class.java)
            when {
                annotation == null ->
                    failures.add("$controller#${method.name} is missing @EndpointDescription")
                annotation.en.isBlank() ->
                    failures.add("$controller#${method.name} has a blank English (en) description")
                annotation.nl.isBlank() ->
                    failures.add("$controller#${method.name} has a blank Dutch (nl) description")
            }
        }

        if (failures.isNotEmpty()) {
            fail(
                "Found ${failures.size} endpoint(s) without a complete @EndpointDescription " +
                    "(both 'en' and 'nl' are required):\n" +
                    failures.sorted().joinToString("\n") { "  - $it" }
            )
        }
    }

    /**
     * Scans the classpath for all controller classes under `com.ritense` and returns every handler
     * method (a method carrying a Spring request-mapping annotation) paired with its controller's
     * simple name.
     */
    private fun findEndpointMethods(): List<Pair<String, Method>> {
        val resolver = PathMatchingResourcePatternResolver()
        val readerFactory = CachingMetadataReaderFactory(resolver)
        val resources = resolver.getResources("classpath*:com/ritense/**/*.class") +
            resolver.getResources("classpath*:com/valtimo/**/*.class")
        val classLoader = Thread.currentThread().contextClassLoader

        val endpoints = mutableListOf<Pair<String, Method>>()
        for (resource in resources) {
            val clazz = try {
                val className = readerFactory.getMetadataReader(resource).classMetadata.className
                Class.forName(className, false, classLoader)
            } catch (_: Throwable) {
                continue
            }

            if (clazz.isInterface || Modifier.isAbstract(clazz.modifiers)) continue
            if (!isController(clazz)) continue

            for (method in clazz.declaredMethods) {
                if (isMapped(method)) {
                    endpoints.add((clazz.simpleName ?: clazz.name) to method)
                }
            }
        }
        return endpoints
    }

    private fun isController(clazz: Class<*>): Boolean =
        clazz.annotations.any {
            val name = it.annotationClass.qualifiedName
            name == "org.springframework.stereotype.Controller" ||
                name == "org.springframework.web.bind.annotation.RestController"
        }

    private fun isMapped(method: Method): Boolean =
        method.isAnnotationPresent(GetMapping::class.java) ||
            method.isAnnotationPresent(PostMapping::class.java) ||
            method.isAnnotationPresent(PutMapping::class.java) ||
            method.isAnnotationPresent(DeleteMapping::class.java) ||
            method.isAnnotationPresent(PatchMapping::class.java) ||
            method.isAnnotationPresent(RequestMapping::class.java)
}
