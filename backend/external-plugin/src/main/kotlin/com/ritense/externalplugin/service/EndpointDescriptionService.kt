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

package com.ritense.externalplugin.service

import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.endpoint.EndpointDescription as EndpointDescriptionAnnotation
import org.springframework.stereotype.Service
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping

/**
 * Resolves human-readable descriptions for API endpoint patterns by reading the [EndpointDescriptionAnnotation]
 * declared on each controller handler method. Used by the management UI when an admin grants endpoint
 * permissions to an external plugin.
 */
@Service
@SkipComponentScan
class EndpointDescriptionService(
    private val handlerMappings: List<RequestMappingHandlerMapping>,
) {

    private val descriptionsByKey: Map<String, Map<String, String>> by lazy { buildIndex() }

    /**
     * Resolves descriptions for the given endpoint keys in the requested locale.
     * Falls back to English, then to a null description if no annotation is registered.
     */
    fun resolveDescriptions(
        endpoints: List<EndpointQuery>,
        locale: String = "en",
    ): List<EndpointDescription> = endpoints.map { query ->
        val method = query.method.uppercase()
        val descriptions = findDescriptions(method, query.pattern)
        EndpointDescription(
            method = method,
            pattern = query.pattern,
            description = descriptions?.get(locale) ?: descriptions?.get("en"),
        )
    }

    private fun buildIndex(): Map<String, Map<String, String>> {
        val index = mutableMapOf<String, Map<String, String>>()
        handlerMappings
            .flatMap { it.handlerMethods.entries }
            .forEach { (info, handlerMethod) ->
                val annotation = handlerMethod.getMethodAnnotation(EndpointDescriptionAnnotation::class.java)
                    ?: return@forEach
                val descriptions = mapOf("en" to annotation.en, "nl" to annotation.nl)
                val methods = info.methodsCondition.methods
                    .map { it.name.uppercase() }
                    .ifEmpty { listOf("GET", "POST", "PUT", "PATCH", "DELETE") }
                for (method in methods) {
                    for (pattern in info.patternValues) {
                        index["$method:$pattern"] = descriptions
                    }
                }
            }
        return index
    }

    private fun findDescriptions(method: String, pattern: String): Map<String, String>? {
        // Try exact match first
        descriptionsByKey["$method:$pattern"]?.let { return it }

        // If the queried pattern contains wildcards, match against registered patterns.
        // Plugin manifests use glob-style `*` while controllers use Spring `{param}` placeholders.
        // Convert the query glob into a regex: `*` matches a single path segment (`[^/]+`),
        // `**` matches any number of segments (`.+`).
        if ("*" in pattern) {
            val regex = buildGlobRegex(pattern)
            return descriptionsByKey.entries
                .firstOrNull { (key, _) -> key.startsWith("$method:") && regex.matches(key.substringAfter(":")) }
                ?.value
        }

        // If the queried pattern contains {param} placeholders, also try matching registered
        // patterns that might use different placeholder names or `*`.
        if ("{" in pattern) {
            val regex = buildGlobRegex(pattern.replace(Regex("\\{[^}]+}"), "*"))
            return descriptionsByKey.entries
                .firstOrNull { (key, _) -> key.startsWith("$method:") && regex.matches(key.substringAfter(":")) }
                ?.value
        }

        return null
    }

    private fun buildGlobRegex(glob: String): Regex {
        val regexStr = buildString {
            append("^")
            var i = 0
            while (i < glob.length) {
                when {
                    glob[i] == '*' && i + 1 < glob.length && glob[i + 1] == '*' -> {
                        append(".+")
                        i += 2
                    }
                    glob[i] == '*' -> {
                        append("[^/]+")
                        i++
                    }
                    glob[i] in "\\{}()[].\$^|+?" -> {
                        append("\\")
                        append(glob[i])
                        i++
                    }
                    else -> {
                        append(glob[i])
                        i++
                    }
                }
            }
            append("$")
        }
        return Regex(regexStr)
    }
}

data class EndpointQuery(
    val method: String,
    val pattern: String,
)

data class EndpointDescription(
    val method: String,
    val pattern: String,
    val description: String?,
)
